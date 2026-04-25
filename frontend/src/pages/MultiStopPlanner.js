import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Calculator.css';
import RouteMap from '../components/RouteMap';
import { useAuth } from '../context/AuthContext';

// ─── Pure Calculation Helpers ───────────────────────────────────────────
const adjustEfficiency = (baseEff, drivingStyle, trafficLevel) => {
  const styleFactor =
    drivingStyle === 'eco'        ? 0.875 :
    drivingStyle === 'aggressive' ? 1.20  :
    1.0;

  const trafficFactor =
    trafficLevel === 'low'  ? 0.95 :
    trafficLevel === 'high' ? 1.18 :
    1.08;

  return baseEff * styleFactor * trafficFactor;
};

// ─── Component ──────────────────────────────────────────────────────────
const MultiStopPlanner = () => {
  const { getToken, user } = useAuth();
  const resultsRef = useRef(null);

  const [vehicles, setVehicles]                 = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [formData, setFormData]                 = useState({
    batteryPercentage: '80', batteryCapacity: '45',
    efficiency: '15', speedKmph: '80', trafficLevel: 'medium', 
    temperatureC: '25', drivingStyle: 'normal'
  });
  
  const [multiStopInput, setMultiStopInput]     = useState('');
  const [multiStopPlan, setMultiStopPlan]       = useState(null);
  const [plannerLoading, setPlannerLoading]     = useState(false);
  const [routeFilters, setRouteFilters]         = useState({ fastChargerOnly: false, availableOnly: false, minPowerKw: '' });
  const [error, setError]                       = useState('');
  const [routeCoords, setRouteCoords]           = useState({ origin: null, dest: null });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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

  const parseMultiStopPoints = async () => {
    const parts = multiStopInput.split('->').map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const points = [];
    for (const part of parts) {
      const c = await geocode(part);
      if (!c) return null;
      points.push({ lat: c.lat, lon: c.lon, label: part });
    }
    return points;
  };

  const handlePlanMultiStop = async (strategy = 'min_stops') => {
    setPlannerLoading(true); setError('');
    try {
      const points = await parseMultiStopPoints();
      if (!points) { setError('Enter format like: Ahmedabad -> Udaipur -> Jaipur'); setPlannerLoading(false); return; }
      
      const adjEff = adjustEfficiency(parseFloat(formData.efficiency), formData.drivingStyle, formData.trafficLevel);
      const tempC = parseFloat(formData.temperatureC) || 25;
      const tempFactor = tempC < 10 ? 1.25 : tempC < 20 ? 1.12 : 1.0;
      const finalEff = adjEff * tempFactor;

      const res = await fetch(`${API_URL}/calculator/multi-stop-plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points, 
          batteryPercentage: parseFloat(formData.batteryPercentage),
          batteryCapacity: parseFloat(formData.batteryCapacity), 
          efficiency: finalEff,
          avgSpeedKmph: parseFloat(formData.speedKmph), 
          optimizeFor: typeof strategy === 'string' ? strategy : 'min_stops', 
          maxStationsToConsider: 20,
          filters: {
            fastChargerOnly: routeFilters.fastChargerOnly,
            availableOnly: routeFilters.availableOnly,
            minPowerKw: routeFilters.minPowerKw ? Number(routeFilters.minPowerKw) : undefined,
            maxDistanceFromRouteKm: 30
          }
        })
      });
      const data = await res.json();
      
      setMultiStopPlan(data);

      if (!res.ok && !data.planned) {
        const errorMsg = data.error || (data.errors?.length > 0 ? data.errors[0].msg : 'Failed to build multi-stop plan');
        setError(errorMsg);
      }

      const resolvedPoints = data.points || points;
      if (resolvedPoints.length >= 2) {
        setRouteCoords({ 
          origin: { lat: resolvedPoints[0].lat, lon: resolvedPoints[0].lon }, 
          dest: { lat: resolvedPoints[resolvedPoints.length - 1].lat, lon: resolvedPoints[resolvedPoints.length - 1].lon } 
        });
      }
      
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err) { 
      console.error(err);
      setError('Network error while planning multi-stop route.'); 
    }
    finally { setPlannerLoading(false); }
  };

  const getMultiStopPath = () => {
    if (!multiStopPlan || !multiStopPlan.legs || multiStopPlan.legs.length === 0) return null;
    const path = [];
    multiStopPlan.legs.forEach((leg, i) => {
      if (i === 0) path.push(leg.from);
      if (leg.stops) {
        leg.stops.forEach(st => path.push({ lat: parseFloat(st.latitude), lon: parseFloat(st.longitude) }));
      }
      path.push(leg.to);
    });
    return path;
  };

  return (
    <div className="calculator-page">
      <div className={`calculator-container${multiStopPlan ? ' has-results' : ''}`}>
        <div className="calc-header">
          <div className="calc-header-icon" style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', width: '60px', height: '60px', borderRadius: '18px' }}>🛤️</div>
          <h2>Multi-Stop Journey Planner</h2>
          <p>Plan complex trips with multiple waypoints and charging optimizations</p>
        </div>

        <div className={`calc-main-content${multiStopPlan ? ' has-results-layout' : ''}`}>
          <div className="calc-form-section">
            <div className="calc-card">
              <div className="multi-stop-planner">
                <div className="calc-form-grid">
                  <div className="form-group form-group-12">
                    <label>Route Points (Separated by →)</label>
                    <input 
                      type="text" 
                      value={multiStopInput} 
                      onChange={(e) => setMultiStopInput(e.target.value)}
                      placeholder="Ahmedabad -> Udaipur -> Jaipur"
                      className="v-input"
                    />
                    <small style={{ color: '#64748b', marginTop: '0.5rem', display: 'block' }}>
                      Enter at least 2 locations separated by arrows.
                    </small>
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
                    <input type="number" name="batteryPercentage" value={formData.batteryPercentage} onChange={handleChange} required min="1" max="100" />
                  </div>
                  <div className="form-group form-group-4">
                    <label>Capacity (kWh)</label>
                    <input type="number" name="batteryCapacity" value={formData.batteryCapacity} onChange={handleChange} required min="1" />
                  </div>
                  <div className="form-group form-group-4">
                    <label>Eff. (kWh/100km)</label>
                    <input type="number" name="efficiency" value={formData.efficiency} onChange={handleChange} required min="1" />
                  </div>

                  <div className="form-group form-group-4">
                    <label>Speed (km/h)</label>
                    <input type="number" name="speedKmph" value={formData.speedKmph} onChange={handleChange} required min="5" />
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
                    <input type="number" name="temperatureC" value={formData.temperatureC} onChange={handleChange} required />
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

                <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
                  <button type="button" className="calculate-button" onClick={handlePlanMultiStop} disabled={plannerLoading} style={{ flex: 2 }}>
                    {plannerLoading ? '⏳ Planning...' : '🚀 Build Plan'}
                  </button>
                  <button type="button" className="calculate-button" onClick={() => handlePlanMultiStop('min_time')} disabled={plannerLoading} 
                    style={{ flex: 1, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', fontSize: '0.85rem' }}>
                    ✨ Optimize
                  </button>
                </div>
              </div>
            </div>
            {error && <div className="error-message" style={{ marginTop: '1rem' }}>⚠️ {error}</div>}
          </div>

          {/* ── RIGHT: Results ──────────────────────────────────────────── */}
          {multiStopPlan && (
            <div className="calc-results-section" ref={resultsRef}>
              <div className="result-card">
                <div className={`route-status ${multiStopPlan.planned ? 'reachable' : 'unreachable'}`}>
                  <div className="route-status-icon">{multiStopPlan.planned ? '✅' : '⚠️'}</div>
                  <div>
                    <h3>{multiStopPlan.planned ? 'Journey Optimized' : 'Incomplete Journey'}</h3>
                    <p className="recommendation">
                      {multiStopPlan.planned 
                        ? 'Your full journey has been mapped out with charging stops.' 
                        : (multiStopPlan.error || 'A portion of your route is not reachable. Showing potential stations along the way.')}
                    </p>
                  </div>
                </div>

                <div className="result-grid">
                  <div className="result-item">
                    <div className="result-label">Total Distance</div>
                    <div className="result-value">
                      {multiStopPlan.totalDistanceKm || (multiStopPlan.legs?.reduce((s,l) => s+l.distanceKm, 0) || 0).toFixed(1)} km
                    </div>
                  </div>
                  <div className="result-item">
                    <div className="result-label">Charging {multiStopPlan.planned ? 'Stops' : 'Found'}</div>
                    <div className="result-value">
                      {multiStopPlan.planned ? multiStopPlan.totalStops : (multiStopPlan.potentialStations?.length || 0)}
                    </div>
                  </div>
                  <div className="result-item" style={{ gridColumn: 'span 2' }}>
                    <div className="result-label">Est. Driving Duration</div>
                    <div className="result-value">
                      {multiStopPlan.totalTimeMinutes 
                        ? `~${Math.floor(multiStopPlan.totalTimeMinutes / 60)}h ${Math.round(multiStopPlan.totalTimeMinutes % 60)}m` 
                        : 'Varies by charging'}
                    </div>
                  </div>
                </div>
                
                {/* ── Journey Details ──────────────────────────────── */}
                <div className="optimized-route-card" style={{ marginTop: '1.5rem' }}>
                   <h4>📍 {multiStopPlan.planned ? 'Journey Points & Stops' : 'Journey Breakdown'}</h4>
                   
                   {!multiStopPlan.planned && (
                     <div style={{ marginBottom: '1.5rem', background: '#fff7ed', padding: '1rem', borderRadius: '12px', border: '1px solid #ffedd5' }}>
                       <p style={{ color: '#9a3412', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>
                         🔋 This plan is incomplete starting from <strong>{multiStopPlan.error?.includes('leg') ? `Step ${multiStopPlan.legIndex}` : 'the start'}</strong>.
                       </p>
                       <p style={{ color: '#c2410c', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                         Check the potential charging points nearby on the map to manually plan your next move.
                       </p>
                     </div>
                   )}

                   <ul style={{ listStyleType: 'none', paddingLeft: 0, marginTop: '0.8rem', fontSize: '0.9rem', color: '#475569' }}>
                     {!multiStopPlan.planned && multiStopPlan.points && multiStopPlan.points.map((pt, idx) => (
                       <li key={`point-${idx}`} style={{ padding: '0.8rem 0', borderBottom: '1px solid #f1f5f9' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <span>{idx === 0 ? '🟢' : idx === multiStopPlan.points.length - 1 ? '🏁' : '📍'}</span>
                           <strong>{idx === 0 ? 'Start:' : idx === multiStopPlan.points.length - 1 ? 'Destination:' : `Waypoint ${idx}:`}</strong>
                           <span>{pt.label || `${pt.lat.toFixed(2)}, ${pt.lon.toFixed(2)}`}</span>
                         </div>
                       </li>
                     ))}

                     {multiStopPlan.planned && multiStopPlan.legs.map((leg, legIdx) => (
                       <React.Fragment key={legIdx}>
                         {legIdx === 0 && (
                           <li style={{ padding: '0.8rem 0', borderBottom: '1px solid #f1f5f9' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                               <span>🟢</span><strong>Start:</strong> {leg.from.label || (leg.from.lat ? `${leg.from.lat.toFixed(2)}, ${leg.from.lon.toFixed(2)}` : 'Origin')}
                             </div>
                           </li>
                         )}
                         {leg.stops?.map((stop, sIdx) => (
                           <li key={`leg-${legIdx}-stop-${sIdx}`} style={{ padding: '0.8rem 0', borderBottom: '1px solid #f1f5f9' }}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <span>
                                 <strong>⚡ Station:</strong> {stop.name || stop.label}
                               </span>
                               {stop.chargeTimeMinutes && (
                                 <span className="badge badge-yellow">Charge: {Math.round(stop.chargeTimeMinutes)}m</span>
                               )}
                             </div>
                             {(stop.address || stop.city) && <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0 20px' }}>{stop.address || stop.city}</p>}
                           </li>
                         ))}
                         <li style={{ padding: '0.8rem 0', borderBottom: '1.5px solid #e2e8f0', background: legIdx < multiStopPlan.legs.length - 1 ? '#f8fafc' : 'transparent' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                               <span>{legIdx < multiStopPlan.legs.length - 1 ? '📍' : '🏁'}</span>
                               <strong>{legIdx < multiStopPlan.legs.length - 1 ? 'Waypoint:' : 'Final Destination:'}</strong>
                               <span>{leg.to.label || `${leg.to.lat.toFixed(2)}, ${leg.to.lon.toFixed(2)}`}</span>
                            </div>
                         </li>
                       </React.Fragment>
                     ))}
                   </ul>

                   {/* MOVED MAP: Below journey details and above potential stations */}
                   {routeCoords.origin && routeCoords.dest && (
                      <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                        <RouteMap
                          originCoords={routeCoords.origin} 
                          destCoords={routeCoords.dest}
                          distance={multiStopPlan.totalDistanceKm || (multiStopPlan.legs?.reduce((s,l) => s+l.distanceKm, 0) || 0).toFixed(1)}
                          stations={multiStopPlan.planned 
                            ? (multiStopPlan.allStationsInCorridor || []).map(st => ({
                                ...st,
                                isPlannedStop: multiStopPlan.legs.some(l => l.stops?.some(stop => stop.id === st.id))
                              }))
                            : (multiStopPlan.potentialStations || []).map(st => ({ ...st, isPlannedStop: false }))}
                          useStationsAsWaypoints={multiStopPlan.planned}
                          pathCoordinates={getMultiStopPath()}
                          waypoints={multiStopPlan.points || []}
                        />
                      </div>
                    )}

                   {!multiStopPlan.planned && multiStopPlan.potentialStations?.length > 0 && (
                     <div style={{ marginTop: '1.5rem' }}>
                        <h5 style={{ color: '#1e293b', marginBottom: '0.8rem', fontSize: '0.95rem' }}>📡 Potential Charging Points Nearby</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {multiStopPlan.potentialStations.map((st, sIdx) => (
                            <div key={sIdx} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                              <div style={{ fontWeight: 700, color: '#4f46e5' }}>⚡ {st.name}</div>
                              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>{st.city || st.state || 'Available Station'}</div>
                            </div>
                          ))}
                        </div>
                     </div>
                   )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultiStopPlanner;
