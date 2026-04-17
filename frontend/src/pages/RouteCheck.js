import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Calculator.css';
import RouteMap from '../components/RouteMap';
import { useAuth } from '../context/AuthContext';

// ─── Pure Calculation Helpers ───────────────────────────────────────────
// correct formula: range_km = (battery_pct/100) * capacity_kwh / (efficiency_kwh_per_100km / 100)
const calcRange = (batteryPct, capacityKwh, effKwhPer100km) => {
  const energy = (batteryPct / 100) * capacityKwh;          // kWh available
  const range  = energy / (effKwhPer100km / 100);            // km
  return range;
};

// Adjust base efficiency (kWh/100km) for driving style + traffic
const adjustEfficiency = (baseEff, drivingStyle, trafficLevel) => {
  const styleFactor =
    drivingStyle === 'eco'        ? 0.875 :  // −12.5% consumption
    drivingStyle === 'aggressive' ? 1.20  :  // +20%  consumption
    1.0;

  const trafficFactor =
    trafficLevel === 'low'  ? 0.95 :   // fewer stops → slightly better
    trafficLevel === 'high' ? 1.18 :   // stop-go → 18% worse
    1.08;                               // medium → 8% worse

  return baseEff * styleFactor * trafficFactor;
};

// battery % needed for a given distance given max range
const batteryNeededPct = (distKm, maxRangeKm) =>
  Math.min(100, (distKm / maxRangeKm) * 100);

// ceiling of stops needed when range is insufficient
const stopsNeeded = (shortfallKm, maxRangeKm) =>
  Math.ceil(shortfallKm / maxRangeKm);

// ─── Component ──────────────────────────────────────────────────────────
const RouteCheck = () => {
  const { getToken, user } = useAuth();
  const resultsRef = useRef(null);

  const [vehicles, setVehicles]                 = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [formData, setFormData]                 = useState({
    distance: '', batteryPercentage: '', batteryCapacity: '60',
    efficiency: '20', unit: 'km', origin: '', destination: '',
    speedKmph: '80', trafficLevel: 'medium', temperatureC: '25',
    drivingStyle: 'normal'
  });
  const [result, setResult]                     = useState(null);
  const [optimizedRoute, setOptimizedRoute]     = useState(null);
  const [routeFilters, setRouteFilters]         = useState({ fastChargerOnly: false, availableOnly: false, minPowerKw: '' });
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState('');
  const [optimizing, setOptimizing]             = useState(false);
  const [routeCoords, setRouteCoords]           = useState({ origin: null, dest: null });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // ── Vehicles ──────────────────────────────────────────────────────────
  useEffect(() => { if (user) fetchVehicles(); }, [user]);

  const fetchVehicles = async () => {
    try {
      const res = await fetch(`${API_URL}/vehicles`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) setVehicles(await res.json());
    } catch (err) { console.error('Failed to fetch vehicles:', err); }
  };

  const handleVehicleSelect = (e) => {
    const vId = e.target.value;
    setSelectedVehicleId(vId);
    if (vId) {
      const v = vehicles.find(v => v.id === Number(vId));
      if (v) setFormData(prev => ({
        ...prev,
        batteryCapacity: v.battery_capacity || v.battery,
        efficiency: v.efficiency
      }));
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // ── Geocoding ──────────────────────────────────────────────────────────
  const haversineKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const geocode = async (addr) => {
    if (!addr) return null;
    try {
      if (addr.includes(',') && addr.split(',').length === 2) {
        const [lat, lng] = addr.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lon: lng };
      }
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`,
        { headers: { 'User-Agent': 'EV-Smart-Assistant-Research-Project' } }
      );
      const d = await res.json();
      return d?.length > 0 ? { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) } : null;
    } catch { return null; }
  };

  // ── Main Submit ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);

    try {
      // ── 1. Parse inputs ──────────────────────────────────────────────
      const battPct  = parseFloat(formData.batteryPercentage);
      const capacity = parseFloat(formData.batteryCapacity);
      const baseEff  = parseFloat(formData.efficiency);

      // ── 2. Validation ────────────────────────────────────────────────
      if (isNaN(battPct) || battPct < 0 || battPct > 100) {
        setError('Battery percentage must be between 0 and 100.');
        setLoading(false); return;
      }
      if (isNaN(capacity) || capacity <= 0) {
        setError('Battery capacity must be a positive number (kWh).');
        setLoading(false); return;
      }
      if (isNaN(baseEff) || baseEff <= 0) {
        setError('Efficiency must be a positive number (kWh/100km).');
        setLoading(false); return;
      }

      // ── 3. Adjust efficiency for driving style + traffic ─────────────
      const adjEff = adjustEfficiency(baseEff, formData.drivingStyle, formData.trafficLevel);

      // Temperature penalty (applied on top)
      const tempC = parseFloat(formData.temperatureC) || 25;
      const tempFactor = tempC < 10 ? 1.25 : tempC < 20 ? 1.12 : 1.0;
      const finalEff = adjEff * tempFactor;

      // ── 4. Geocode & Distance ────────────────────────────────────────
      let distKm = formData.distance?.trim() ? parseFloat(formData.distance) : null;
      let originCoords = null, destCoords = null;

      if (!distKm || isNaN(distKm)) {
        if (!formData.origin || !formData.destination) {
          setError('Please enter both an Origin and a Destination.'); setLoading(false); return;
        }
        originCoords = await geocode(formData.origin);
        destCoords   = await geocode(formData.destination);
        if (!originCoords) { setError(`Couldn't locate "${formData.origin}". Try adding city/state.`); setLoading(false); return; }
        if (!destCoords)   { setError(`Couldn't locate "${formData.destination}". Try adding city/state.`); setLoading(false); return; }
        distKm = haversineKm(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon);
        setRouteCoords({ origin: originCoords, dest: destCoords });
      } else if (formData.origin && formData.destination) {
        originCoords = await geocode(formData.origin);
        destCoords   = await geocode(formData.destination);
        if (originCoords && destCoords) setRouteCoords({ origin: originCoords, dest: destCoords });
      }

      if (!distKm || isNaN(distKm) || distKm <= 0) {
        setError('Could not determine distance. Check your Origin and Destination.'); setLoading(false); return;
      }

      // ── 6. Core Range Calculation (CORRECTED FORMULA) ─────────────────
      const maxRange   = calcRange(100, capacity, finalEff);   // full-charge range
      const availRange = calcRange(battPct, capacity, finalEff); // current range

      // ── 7. Feasibility ────────────────────────────────────────────────
      const isReachable   = availRange >= distKm;
      const remainingKm   = availRange - distKm;
      const shortfallKm   = isReachable ? 0 : distKm - availRange;
      const battNeededPct = batteryNeededPct(distKm, maxRange);
      const extraBattPct  = isReachable ? 0 : battNeededPct - battPct;
      const stops         = isReachable ? 0 : stopsNeeded(shortfallKm, availRange > 0 ? availRange : maxRange);

      // ── 8. Determine status tier ──────────────────────────────────────
      const statusTier = isReachable ? 'green' : stops <= 2 ? 'yellow' : 'red';

      // ── 9. Build recommendation message ──────────────────────────────
      let recommendation;
      if (isReachable) {
        recommendation = `✔ Trip possible without charging. You'll arrive with ~${Math.round(remainingKm)} km to spare.`;
      } else if (stops <= 2) {
        recommendation = `⚠ ${stops} charging stop${stops > 1 ? 's' : ''} required. Need ~${Math.round(extraBattPct)}% more charge (${Math.round(shortfallKm)} km shortfall).`;
      } else {
        recommendation = `🔴 Not feasible directly. Need ${stops} charging stops. Range shortfall: ${Math.round(shortfallKm)} km.`;
      }

      // ── 11. Call backend (for station data) ───────────────────────────
      const res = await fetch(`${API_URL}/calculator/route-check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batteryPercentage: battPct, batteryCapacity: capacity,
          efficiency: finalEff, distance: distKm, unit: 'km',
          origin: formData.origin.trim(), destination: formData.destination.trim(),
          originCoords, destCoords
        })
      });
      const data = await res.json();

      if (res.ok) {
        setResult({
          ...data,
          distance:        { kilometers: Math.round(distKm * 10) / 10 },
          currentRange:    { kilometers: Math.round(availRange * 10) / 10 },
          maxRange:        { kilometers: Math.round(maxRange * 10) / 10 },
          isReachable,
          remainingRange:  { kilometers: Math.round(remainingKm * 10) / 10 },
          shortfallKm:     Math.round(shortfallKm * 10) / 10,
          batteryNeeded:   Math.round(battNeededPct * 10) / 10,
          extraBattPct:    Math.round(extraBattPct * 10) / 10,
          chargingStops:   stops,
          statusTier,
          adjustedEfficiency: Math.round(finalEff * 10) / 10,
          baseEfficiency: baseEff,
          recommendation,
        });

        // Scroll to results
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else {
        setError(data.error || data.errors?.[0]?.msg || 'An error occurred.');
      }
    } catch (err) {
      console.error('Route check error:', err);
      setError('Network error. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  // ── Optimize Route ─────────────────────────────────────────────────────
  const handleOptimizeRoute = async () => {
    if (!routeCoords.origin || !routeCoords.dest) { setError('Please set Origin and Destination first.'); return; }
    setError(''); setOptimizing(true);
    try {
      const res = await fetch(`${API_URL}/calculator/optimize-route`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originCoords: routeCoords.origin, destCoords: routeCoords.dest,
          batteryPercentage: parseFloat(formData.batteryPercentage),
          batteryCapacity: parseFloat(formData.batteryCapacity),
          efficiency: parseFloat(formData.efficiency),
          optimizeFor: 'min_stops', avgSpeedKmph: 80, maxStationsToConsider: 15,
          filters: {
            fastChargerOnly: routeFilters.fastChargerOnly,
            availableOnly: routeFilters.availableOnly,
            minPowerKw: routeFilters.minPowerKw ? Number(routeFilters.minPowerKw) : undefined,
            maxDistanceFromRouteKm: 20
          }
        })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to optimize route'); return; }
      setOptimizedRoute(data);
    } catch { setError('Network error. Please check if the server is running.'); }
    finally { setOptimizing(false); }
  };

  // ── Geolocation ────────────────────────────────────────────────────────
  const getCurrentLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    setLoading(true); setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'EV-Assistant-App/1.0' } }
          );
          const data = await res.json();
          const addr = data.address;
          const parts = [];
          if (addr?.road) parts.push(addr.road);
          if (addr?.suburb) parts.push(addr.suburb);
          if (addr?.city || addr?.town || addr?.village) parts.push(addr.city || addr.town || addr.village);
          if (addr?.state) parts.push(addr.state);
          setFormData(prev => ({ ...prev, origin: parts.length > 0 ? parts.join(', ') : data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` }));
        } catch {
          const { latitude, longitude } = pos.coords;
          setFormData(prev => ({ ...prev, origin: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` }));
        }
        setLoading(false);
      },
      (err) => {
        const msgs = { 1: 'Location permission denied', 2: 'Location unavailable', 3: 'Location request timed out' };
        setError(msgs[err.code] || 'Unable to retrieve your location');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ── Status Tier Helpers ────────────────────────────────────────────────
  const statusConfig = {
    green:  { icon: '✅', label: 'Trip Possible',       cls: 'reachable',          badgeCls: 'badge-green' },
    yellow: { icon: '⚠️', label: 'Charging Required',  cls: 'charging-required',   badgeCls: 'badge-yellow' },
    red:    { icon: '🔴', label: 'Not Directly Feasible', cls: 'not-feasible',      badgeCls: 'badge-red' },
  };

  return (
    <div className="calculator-page">
      <div className={`calculator-container${result ? ' has-results' : ''}`}>

        <div className="calc-header">
          <div className="calc-header-icon" style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', width: '60px', height: '60px', borderRadius: '18px' }}>🗺️</div>
          <h2>Route Feasibility Checker</h2>
          <p>Analyze trip range and find charging stations along your path</p>
        </div>

        <div className={`calc-main-content${result ? ' has-results-layout' : ''}`}>
          {/* ── LEFT: Form ───────────────────────────────────────────── */}
          <div className="calc-form-section">
            <div className="calc-card">
              <form onSubmit={handleSubmit}>
                <div className="calc-form-grid">
                  <div className="form-group form-group-6">
                    <label>Origin</label>
                    <div className="input-location-wrap">
                      <input type="text" name="origin" value={formData.origin} onChange={handleChange} placeholder="Starting Point" required />
                      <button type="button" className="btn-current-location" onClick={getCurrentLocation} title="My Location">📍</button>
                    </div>
                  </div>
                  <div className="form-group form-group-6">
                    <label>Destination</label>
                    <div className="input-location-wrap">
                      <input type="text" name="destination" value={formData.destination} onChange={handleChange} placeholder="Destination" required />
                    </div>
                  </div>

                  <div className="form-group form-group-12 vehicle-selector-group">
                    <label>Select Your Car (Auto-fills Specs)</label>
                    {user ? (
                      vehicles.length > 0 ? (
                        <select value={selectedVehicleId} onChange={handleVehicleSelect} className="vehicle-selector">
                          <option value="">-- Choose from your fleet --</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.name} ({v.battery_capacity || v.battery}kWh)</option>
                          ))}
                        </select>
                      ) : (
                        <div className="no-vehicles-info">
                          <span>No vehicles found.</span>
                          <Link to="/vehicles" className="inline-link">Add one in Fleet Management</Link>
                        </div>
                      )
                    ) : (
                      <div className="no-vehicles-info">
                        <span>Sign in to select from your saved vehicles.</span>
                      </div>
                    )}
                  </div>

                  <div className="form-group form-group-4">
                    <label>Battery (%)</label>
                    <input type="number" name="batteryPercentage" value={formData.batteryPercentage}
                      onChange={handleChange} required min="1" max="100" />
                  </div>
                  <div className="form-group form-group-4">
                    <label>Capacity (kWh)</label>
                    <input type="number" name="batteryCapacity" value={formData.batteryCapacity}
                      onChange={handleChange} required min="1" />
                  </div>
                  <div className="form-group form-group-4">
                    <label>Eff. (kWh/100km)</label>
                    <input type="number" name="efficiency" value={formData.efficiency}
                      onChange={handleChange} required min="1" />
                  </div>

                  <div className="form-group form-group-4">
                    <label>Speed (km/h)</label>
                    <input type="number" name="speedKmph" value={formData.speedKmph}
                      onChange={handleChange} required min="5" />
                  </div>
                  <div className="form-group form-group-4">
                    <label>Traffic</label>
                    <select name="trafficLevel" value={formData.trafficLevel} onChange={handleChange}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="form-group form-group-4">
                    <label>Temp (°C)</label>
                    <input type="number" name="temperatureC" value={formData.temperatureC}
                      onChange={handleChange} required />
                  </div>

                  <div className="form-group form-group-12">
                    <label>Driving Style</label>
                    <div className="segment-control">
                      {[['eco', '🌿 Eco'], ['normal', '⚡ Normal'], ['aggressive', '🏁 Sport']].map(([val, label]) => (
                        <button key={val} type="button"
                          className={formData.drivingStyle === val ? 'active' : ''}
                          onClick={() => setFormData({ ...formData, drivingStyle: val })}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button type="submit" className="calculate-button" disabled={loading} style={{ marginTop: '1rem' }}>
                  {loading ? '⏳ Analyzing...' : 'Check Route Feasibility'}
                </button>
              </form>
            </div>
            {error && <div className="error-message" style={{ marginTop: '1rem' }}>⚠️ {error}</div>}
          </div>

          {/* ── RIGHT: Results ──────────────────────────────────────────── */}
          {result && (
            <div className="calc-results-section" ref={resultsRef}>
              <div className="result-card">
              
                <div className={`route-status ${statusConfig[result.statusTier]?.cls || 'reachable'}`}>
                  <div className="route-status-icon">{statusConfig[result.statusTier]?.icon}</div>
                  <div>
                    <h3>{statusConfig[result.statusTier]?.label}</h3>
                    <p className="recommendation">{result.recommendation}</p>
                  </div>
                </div>

                <div className="result-grid">
                  <div className="result-item">
                    <div className="result-label">Distance</div>
                    <div className="result-value">{result.distance.kilometers} km</div>
                  </div>
                  <div className="result-item">
                    <div className="result-label">Current Range</div>
                    <div className={`result-value ${result.isReachable ? 'status-reachable' : 'status-unreachable'}`}>
                      {result.currentRange.kilometers} km
                    </div>
                  </div>
                  <div className="result-item">
                    <div className="result-label">Max Range</div>
                    <div className="result-value">{result.maxRange.kilometers} km</div>
                  </div>
                  <div className="result-item">
                    <div className="result-label">Battery Needed</div>
                    <div className={`result-value ${result.batteryNeeded > parseFloat(formData.batteryPercentage) ? 'status-unreachable' : 'status-reachable'}`}>
                      {result.batteryNeeded}%
                    </div>
                  </div>

                  {result.isReachable ? (
                    <div className="result-item">
                      <div className="result-label">Remaining</div>
                      <div className="result-value status-reachable">{result.remainingRange.kilometers} km</div>
                    </div>
                  ) : (
                    <>
                      <div className="result-item">
                        <div className="result-label">Shortfall</div>
                        <div className="result-value status-unreachable">{result.shortfallKm} km</div>
                      </div>
                      <div className="result-item">
                        <div className="result-label">Charging Stops</div>
                        <div className="result-value status-warn">{result.chargingStops}</div>
                      </div>
                    </>
                  )}

                  <div className="result-item">
                    <div className="result-label">Adj. Efficiency</div>
                    <div className="result-value">{result.adjustedEfficiency} kWh/100km</div>
                  </div>
                </div>

                {routeCoords.origin && routeCoords.dest && (
                  <RouteMap
                    originCoords={routeCoords.origin} destCoords={routeCoords.dest}
                    distance={optimizedRoute?.totalDistanceKm || result.distance.kilometers}
                    stations={optimizedRoute?.optimized ? optimizedRoute.stops : (result.chargingStations?.stations || [])}
                    useStationsAsWaypoints={!!optimizedRoute?.optimized}
                    currentRange={result.currentRange?.kilometers || result.currentRange}
                    isDefaultReachable={result.isReachable}
                  />
                )}

                {optimizedRoute?.optimized && (
                  <div className="optimized-route-card">
                    <h4>🚀 Optimized Trip Plan</h4>
                    <p>Stops: {optimizedRoute.totalStops} &nbsp;|&nbsp; Est. Time: {optimizedRoute.totalTimeMinutes} min</p>
                  </div>
                )}

                {!optimizedRoute?.optimized && !result.isReachable && result.chargingStations?.stations?.length > 0 && (
                  <div className="charging-stations-recommendation">
                    <h4>🔌 Recommended Stations</h4>
                    {result.chargingStations.stations.slice(0, 5).map((s, i) => (
                      <div key={s.id || i} className="station-recommendation-card">
                        <div className="station-card-info">
                          <h5>{s.name}</h5>
                          <p>📍 {s.address}, {s.city}</p>
                          <p>🔌 {s.connector_type} &nbsp;|&nbsp; ⚡ {s.power_kw} kW</p>
                        </div>
                        <div className="station-card-actions">
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`} target="_blank" rel="noopener noreferrer" className="map-link">Navigate</a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {routeCoords.origin && routeCoords.dest && (
                <button type="button" className="calculate-button" onClick={handleOptimizeRoute} disabled={optimizing}
                  style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', marginTop: '1rem' }}>
                  {optimizing ? '⏳ Optimizing...' : '🚀 Get Optimized Stop Plan'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouteCheck;