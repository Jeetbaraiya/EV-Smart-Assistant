import React, { useState, useEffect, useRef } from 'react';
import './Calculator.css';

const RangeCalculator = () => {
  const [formData, setFormData] = useState({
    batteryPercentage: '',
    batteryCapacity: '60',
    efficiency: '20',
    speedKmph: '80',
    trafficLevel: 'medium',
    temperatureC: '25',
    drivingStyle: 'normal'
  });
  const [result, setResult] = useState(null);
  const [effectiveEfficiency, setEffectiveEfficiency] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const rangeResultRef = useRef(null);
  const destResultRef = useRef(null);
  const [showDestinationCheck, setShowDestinationCheck] = useState(false);
  const [destinationData, setDestinationData] = useState({ origin: '', destination: '', useCurrentLocation: false });
  const [destinationResult, setDestinationResult] = useState(null);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [destinationError, setDestinationError] = useState('');
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const handleChange = (e) => {
    let { name, value } = e.target;
    
    // Strip leading zeros for specific numeric fields, but allow single '0' or decimals
    if (['batteryPercentage', 'batteryCapacity', 'efficiency'].includes(name)) {
      if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) {
        value = value.replace(/^0+/, '');
      }
    }
    
    setFormData({ ...formData, [name]: value });
  };

  const scrollToElementSlowly = (element, duration = 900) => {
    if (!element) return;
    const headerOffset = 60;
    const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - headerOffset;
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    let startTime = null;
    const easeOut = (t, b, c, d) => { t /= d / 2; if (t < 1) return c / 2 * t * t + b; t--; return -c / 2 * (t * (t - 2) - 1) + b; };
    const animation = (currentTime) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      window.scrollTo(0, easeOut(timeElapsed, startPosition, distance, duration));
      if (timeElapsed < duration) requestAnimationFrame(animation);
    };
    requestAnimationFrame(animation);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true); setResult(null); setEffectiveEfficiency(null);
    try {
      const res = await fetch(`${API_URL}/calculator/predict-range`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batteryPercentage: parseFloat(formData.batteryPercentage),
          batteryCapacity: parseFloat(formData.batteryCapacity),
          efficiency: parseFloat(formData.efficiency),
          speedKmph: parseFloat(formData.speedKmph),
          trafficLevel: formData.trafficLevel,
          temperatureC: parseFloat(formData.temperatureC),
          drivingStyle: formData.drivingStyle
        })
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setEffectiveEfficiency(typeof data.adjustedEfficiency === 'number' ? data.adjustedEfficiency : parseFloat(formData.efficiency));
        setShowDestinationCheck(true);
        setTimeout(() => scrollToElementSlowly(rangeResultRef.current), 100);
      } else {
        setError(data.error || data.errors?.[0]?.msg || 'An error occurred');
      }
    } catch { setError('Network error. Please check if the server is running.'); }
    finally { setLoading(false); }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return setDestinationError('Geolocation is not supported by your browser');
    setDestinationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`, { headers: { 'User-Agent': 'EV-Assistant-App/1.0' } });
          const data = await res.json();
          setDestinationData({ ...destinationData, origin: data.display_name || `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`, useCurrentLocation: true });
        } catch {
          setDestinationData({ ...destinationData, origin: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`, useCurrentLocation: true });
        }
        setDestinationLoading(false);
      },
      () => { setDestinationError('Unable to retrieve your location.'); setDestinationLoading(false); }
    );
  };

  const handleDestinationCheck = async (e) => {
    e.preventDefault();
    setDestinationError(''); setDestinationLoading(true); setDestinationResult(null);
    if (!result) { setDestinationError('Please calculate range first'); setDestinationLoading(false); return; }
    try {
      const res = await fetch(`${API_URL}/calculator/destination-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: destinationData.origin, destination: destinationData.destination,
          batteryPercentage: parseFloat(formData.batteryPercentage),
          batteryCapacity: parseFloat(formData.batteryCapacity),
          efficiency: parseFloat(effectiveEfficiency || formData.efficiency),
          currentRange: result.range.kilometers,
          useCurrentLocation: destinationData.useCurrentLocation
        })
      });
      const data = await res.json();
      if (res.ok) { setDestinationResult(data); setTimeout(() => scrollToElementSlowly(destResultRef.current), 100); }
      else setDestinationError(data.error || data.errors?.[0]?.msg || 'An error occurred');
    } catch { setDestinationError('Network error. Please check if the server is running.'); }
    finally { setDestinationLoading(false); }
  };

  return (
    <div className="calculator-page">
      <div className={`calculator-container${result ? ' has-results' : ''}`}>

        {/* ── Header ─────────────────────────────── */}
        <div className="calc-header">
          <div className="calc-header-icon">🔋</div>
          <h2>Battery Range Calculator</h2>
          <p>Get an AI-adjusted range estimate factoring in weather, traffic, and your driving style.</p>
        </div>

        {/* ── Split Layout ────────────────────────── */}
        <div className={result ? 'calc-split-layout' : ''}>

          {/* LEFT: Inputs */}
          <div className={result ? 'calc-left-panel' : ''}>
            <div className="calc-card">
              <p className="calc-card-title">⚡ Vehicle &amp; Conditions</p>
              <form onSubmit={handleSubmit}>
                <div className="calc-form-grid">

                  <div className="form-group form-group-full">
                    <label>Current Battery (%)</label>
                    <input type="number" name="batteryPercentage" value={formData.batteryPercentage}
                      onChange={handleChange} required min="0" max="100" step="0.1" placeholder="e.g. 75" />
                  </div>

                  <div className="form-group">
                    <label>Battery Capacity (kWh)</label>
                    <input type="number" name="batteryCapacity" value={formData.batteryCapacity}
                      onChange={handleChange} required min="0" step="0.1" placeholder="60" />
                    <small>Default: 60 kWh</small>
                  </div>

                  <div className="form-group">
                    <label>Efficiency (kWh/100km)</label>
                    <input type="number" name="efficiency" value={formData.efficiency}
                      onChange={handleChange} required min="0" step="0.1" placeholder="20" />
                    <small>Default: 20 kWh/100km</small>
                  </div>

                  <div className="form-group">
                    <label>Speed (km/h)</label>
                    <input type="number" name="speedKmph" value={formData.speedKmph}
                      onChange={handleChange} required min="5" step="1" placeholder="80" />
                  </div>

                  <div className="form-group">
                    <label>Temperature (°C)</label>
                    <input type="number" name="temperatureC" value={formData.temperatureC}
                      onChange={handleChange} required step="1" placeholder="25" />
                  </div>

                  <div className="form-group">
                    <label>Traffic Level</label>
                    <select name="trafficLevel" value={formData.trafficLevel} onChange={handleChange}>
                      <option value="low">🟢 Low Traffic</option>
                      <option value="medium">🟡 Medium Traffic</option>
                      <option value="high">🔴 High Traffic</option>
                    </select>
                  </div>

                  <div className="form-group form-group-full">
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

                <button type="submit" className="calculate-button" disabled={loading}>
                  {loading ? '⏳ Calculating...' : '🚀 Calculate Range'}
                </button>
              </form>
            </div>

            {error && <div className="error-message">⚠️ {error}</div>}
          </div>

          {/* RIGHT: Results */}
          {result && (
            <div className="calc-right-panel">

              {/* ── Range Result ─────────────────── */}
              <div className="result-card" ref={rangeResultRef}>
                <h3>📊 Your Range Estimate</h3>
                <div className="result-grid">
                  <div className="result-item">
                    <div className="result-label">Estimated Range</div>
                    <div className="result-value">{result.range.kilometers} km</div>
                  </div>
                  <div className="result-item">
                    <div className="result-label">Available Energy</div>
                    <div className="result-value">{result.availableEnergy} kWh</div>
                  </div>
                  {typeof result.adjustedEfficiency === 'number' && (
                    <div className="result-item">
                      <div className="result-label">Adjusted Efficiency</div>
                      <div className="result-value">{result.adjustedEfficiency} kWh</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Destination Check ─────────────── */}
              {showDestinationCheck && (
                <div className="destination-check-section">
                  <h3>📍 Check Destination Reachability</h3>
                  <p>Enter your start and destination to check if you can make it on the current charge.</p>
                  <form onSubmit={handleDestinationCheck}>
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div className="form-group">
                        <label>Origin (Starting Point)</label>
                        <div className="input-location-wrap">
                          <input type="text" value={destinationData.origin}
                            onChange={(e) => setDestinationData({ ...destinationData, origin: e.target.value })}
                            placeholder="Enter your starting address" required />
                          <button type="button" onClick={getCurrentLocation} disabled={destinationLoading} className="btn-current-location">
                            📍 My Location
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label>Destination</label>
                      <input type="text" value={destinationData.destination}
                        onChange={(e) => setDestinationData({ ...destinationData, destination: e.target.value })}
                        placeholder="Enter your destination" required />
                    </div>
                    <button type="submit" className="calculate-button" disabled={destinationLoading}>
                      {destinationLoading ? '⏳ Checking...' : '🗺️ Check Destination'}
                    </button>
                  </form>

                  {destinationError && <div className="error-message" style={{ marginTop: '1rem' }}>⚠️ {destinationError}</div>}

                  {destinationResult && (
                    <div className="result-card" ref={destResultRef} style={{ marginTop: '1.5rem', boxShadow: 'none', borderColor: '#e2e8f0' }}>
                      <h3>Destination Analysis</h3>
                      <div className="result-grid">
                        <div className="result-item">
                          <div className="result-label">Distance</div>
                          <div className="result-value">{destinationResult.distance.kilometers} km</div>
                        </div>
                        <div className="result-item">
                          <div className="result-label">Your Range</div>
                          <div className="result-value">{destinationResult.currentRange.kilometers} km</div>
                        </div>
                        <div className="result-item">
                          <div className="result-label">Status</div>
                          <div className={`result-value ${destinationResult.isReachable ? 'status-reachable' : 'status-unreachable'}`}>
                            {destinationResult.isReachable ? '✅ Go!' : '⚠️ Charge'}
                          </div>
                        </div>
                      </div>

                      <div className="recommendation-box" style={{
                        background: destinationResult.isReachable ? '#f0fdf4' : '#fffbeb',
                        border: `1.5px solid ${destinationResult.isReachable ? '#86efac' : '#fcd34d'}`,
                        color: destinationResult.isReachable ? '#166534' : '#92400e'
                      }}>
                        {destinationResult.recommendation}
                        {!destinationResult.isReachable && destinationResult.batteryNeeded > 0 && (
                          <span> You need approx. <strong>{destinationResult.batteryNeeded}%</strong> more battery.</span>
                        )}
                      </div>

                      {!destinationResult.isReachable && destinationResult.chargingStations?.length > 0 && (
                        <div className="charging-stations-recommendation">
                          <h4>🔌 Charging Stations Along Route</h4>
                          <p>Top stations to help you reach your destination:</p>
                          {destinationResult.chargingStations.slice(0, 5).map((s, i) => (
                            <div key={s.id || i} className="station-recommendation-card">
                              <div className="station-card-info">
                                <h5>{s.name}</h5>
                                <p>📍 {s.address}, {s.city}, {s.state}</p>
                                <p>🔌 {s.connector_type} &nbsp;|&nbsp; ⚡ {s.power_kw} kW</p>
                                {s.distance !== undefined && <p className="station-distance">📏 {s.distance} km from route</p>}
                              </div>
                              {s.latitude && s.longitude && (
                                <div className="station-card-actions">
                                  <a href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`} target="_blank" rel="noopener noreferrer" className="map-link">🗺️ Map</a>
                                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`} target="_blank" rel="noopener noreferrer" className="map-link">🧭 Directions</a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RangeCalculator;
