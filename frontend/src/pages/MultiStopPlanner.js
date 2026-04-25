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

  const calculateFailurePoint = () => {
    if (!multiStopPlan || multiStopPlan.planned || !multiStopPlan.allLegs) return null;
    
    const capacity = parseFloat(formData.batteryCapacity);
    const efficiency = parseFloat(formData.efficiency);
    const startBatt = parseFloat(formData.batteryPercentage);
    
    // Initial range
    let currentRange = (startBatt / 100) * capacity / (efficiency / 100);
    
    for (const leg of multiStopPlan.allLegs) {
      if (leg.distanceKm > currentRange) {
        return {
          rangeKm: Math.round(currentRange),
          segmentDistance: Math.round(leg.distanceKm),
          from: leg.from.label || 'the previous point',
          to: leg.to.label || 'the next destination'
        };
      }
      currentRange -= leg.distanceKm;
      if (currentRange < 0) currentRange = 0;
    }
    return null;
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

                <button type="button" className="calculate-button" onClick={handlePlanMultiStop} disabled={plannerLoading}
                  style={{ marginTop: '1.5rem' }}>
                  {plannerLoading ? '⏳ Planning...' : '🚀 Build Multi-Stop Plan'}
                </button>
              </div>
            </div>
            {error && <div className="error-message" style={{ marginTop: '1rem' }}>⚠️ {error}</div>}
          </div>

          {/* ── RIGHT: Results ──────────────────────────────────────────── */}
          {multiStopPlan && (
            <div className="calc-results-section" ref={resultsRef}>
              <div className="result-card">
                <div className={`route-status ${multiStopPlan.planned ? 'reachable' : 'unreachable'}`} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div className="route-status-icon" style={{ marginBottom: 0 }}>{multiStopPlan.planned ? '✅' : '⚠️'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h3 style={{ margin: 0 }}>{multiStopPlan.planned ? 'Journey Optimized' : 'Incomplete Journey'}</h3>
                    {multiStopPlan.planned && (
                      <p className="recommendation" style={{ margin: '4px 0 0 0' }}>
                        Your full journey has been mapped out with charging stops.
                      </p>
                    )}
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
                     <div style={{ marginBottom: '1.5rem', background: '#fff7ed', padding: '1.25rem', borderRadius: '16px', border: '1px solid #ffedd5', boxShadow: '0 4px 12px rgba(251, 191, 36, 0.1)' }}>
                       <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                         <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                         <div style={{ flex: 1 }}>
                           <h4 style={{ color: '#9a3412', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Journey Incomplete</h4>
                           {(() => {
                             const failure = calculateFailurePoint();
                             if (failure) {
                               return (
                                 <>
                                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '1rem' }}>
                                      <div style={{ padding: '4px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                                        🔋 Range: ~{failure.rangeKm} km
                                      </div>
                                      <div style={{ padding: '4px 12px', background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                                        📍 Next segment: {failure.from} → {failure.to} (~{failure.segmentDistance} km)
                                      </div>
                                   </div>

                                   {multiStopPlan.recommendedStation && (
                                     <div style={{ background: '#fffbeb', padding: '1rem', borderRadius: '12px', border: '1px solid #fef3c7', marginBottom: '1rem' }}>
                                       <p style={{ color: '#b45309', fontSize: '0.9rem', fontWeight: 700, margin: '0 0 5px 0' }}>⚡ Recommended Stop:</p>
                                       <p style={{ color: '#1e293b', fontSize: '0.95rem', margin: 0 }}>
                                         <strong>{multiStopPlan.recommendedStation.name}</strong> (~{multiStopPlan.recommendedStation.distance} km from {multiStopPlan.recommendedStation.from})
                                       </p>
                                       <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '8px' }}>
                                         Continue your journey after charging here.
                                       </p>
                                     </div>
                                   )}
                                   
                                   {!multiStopPlan.recommendedStation && (
                                     <div style={{ background: 'white', padding: '0.8rem', borderRadius: '8px', border: '1px dashed #fbbf24' }}>
                                       <p style={{ color: '#1e293b', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 4px 0' }}>⚡ Suggested Action:</p>
                                       <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                                         Add a charging stop between <strong>{failure.from}</strong> → <strong>{failure.to}</strong> to continue safely.
                                       </p>
                                     </div>
                                   )}
                                 </>
                               );
                             }
                             return (
                               <p style={{ color: '#475569', fontSize: '0.9rem', margin: 0 }}>
                                 {multiStopPlan.error || 'The journey cannot be completed with current battery levels and charging infrastructure.'}
                               </p>
                             );
                           })()}
                         </div>
                       </div>
                     </div>
                   )}

                   <ul style={{ listStyleType: 'none', paddingLeft: 0, marginTop: '0.8rem', fontSize: '0.9rem', color: '#475569' }}>
                     {!multiStopPlan.planned && multiStopPlan.allLegs && multiStopPlan.allLegs.map((leg, idx) => {
                       const isFailedLeg = multiStopPlan.legIndex === leg.index;
                       const recommended = isFailedLeg ? multiStopPlan.recommendedStation : null;

                       return (
                        <React.Fragment key={`leg-fail-${idx}`}>
                          {idx === 0 && (
                            <li style={{ padding: '0.8rem 0', borderBottom: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>🟢</span><strong>Start:</strong> {leg.from.label || 'Origin'}
                              </div>
                            </li>
                          )}
                          
                          {recommended && (
                            <li style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.08)', border: '1.5px dashed #f59e0b', borderRadius: '12px', margin: '0.5rem 0' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                 <span style={{ color: '#b45309', fontWeight: 700 }}>
                                   ⚡ Recommended Charging Stop:
                                 </span>
                                 <span className="badge badge-yellow" style={{ background: '#f59e0b', color: 'white' }}>~{recommended.distance} km from {recommended.from}</span>
                               </div>
                               <div style={{ marginTop: '5px', fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
                                 {recommended.name}
                               </div>
                               <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>{recommended.city || 'Highway / Nearby City'}</p>
                            </li>
                          )}

                          <li style={{ padding: '0.8rem 0', borderBottom: '1px solid #f1f5f9', opacity: leg.index > multiStopPlan.legIndex ? 0.5 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{idx === multiStopPlan.allLegs.length - 1 ? '🏁' : '📍'}</span>
                              <strong>{idx === multiStopPlan.allLegs.length - 1 ? 'Final Destination:' : `Waypoint ${idx + 1}:`}</strong>
                              <span>{leg.to.label}</span>
                            </div>
                          </li>
                        </React.Fragment>
                       );
                     })}

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
                            : (multiStopPlan.potentialStations || []).map(st => ({ 
                                ...st, 
                                isPlannedStop: st.id === multiStopPlan.recommendedStation?.id 
                              }))}
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
                          {multiStopPlan.potentialStations.map((st, sIdx) => {
                            const isRecommended = st.id === multiStopPlan.recommendedStation?.id;
                            return (
                              <div key={sIdx} style={{ 
                                padding: '0.75rem', 
                                background: isRecommended ? 'rgba(245, 158, 11, 0.1)' : '#f8fafc', 
                                borderRadius: '8px', 
                                border: isRecommended ? '1px solid #f59e0b' : '1px solid #e2e8f0', 
                                fontSize: '0.85rem',
                                position: 'relative'
                              }}>
                                <div style={{ fontWeight: 700, color: isRecommended ? '#b45309' : '#4f46e5' }}>
                                  ⚡ {st.name} {isRecommended && <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginLeft: '5px' }}>(Recommended)</span>}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>{st.city || st.state || 'Available Station'}</div>
                              </div>
                            );
                          })}
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
