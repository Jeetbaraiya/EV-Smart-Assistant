import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const IconStation = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17a4 4 0 0 0 8 0c0-4-8-8-8-8s-8 4-8 8a4 4 0 0 0 8 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="10" y1="11" x2="14" y2="11"/></svg>
);

const CONNECTOR_TYPES = [
  'CCS2', 'Type 2', 'CHAdeMO', 'Bharat DC-001',
  'Bharat AC-001', 'GB/T', '15A/16A Socket', 'Other'
];

const OwnerStations = () => {
  const { getToken, user } = useAuth();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [formData, setFormData] = useState({
    name: '', address: '', city: '', state: '', zip_code: '',
    latitude: '', longitude: '', connector_types: [], power_kw: '',
    price_per_kw: '', availability: 'available'
  });
  const [reviewState, setReviewState] = useState({});
  const [hoveredRatingStation, setHoveredRatingStation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchMyStations();
  }, []);

  const fetchMyStations = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/stations/owner/my-stations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setStations(data.stations || []);
      else setError(data.error || 'Failed to fetch stations');
    } catch {
      setError('Network error. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewsForHover = async (stationId) => {
    const key = String(stationId);
    if (reviewState[key]?.reviews?.length > 0 || reviewState[key]?.loading) return;

    setReviewState(prev => ({ ...prev, [key]: { loading: true } }));
    try {
      const res = await fetch(`${API_URL}/stations/${encodeURIComponent(stationId)}/reviews`);
      const data = await res.json();
      if (res.ok) {
        setReviewState(prev => ({ ...prev, [key]: { loading: false, reviews: data.reviews || [] } }));
      } else {
        setReviewState(prev => ({ ...prev, [key]: { loading: false, reviews: [] } }));
      }
    } catch (e) {
      setReviewState(prev => ({ ...prev, [key]: { loading: false, reviews: [] } }));
    }
  };

  const handleStatusChange = async (stationId, newStatus) => {
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/stations/${stationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ availability: newStatus })
      });
      if (res.ok) fetchMyStations();
      else {
        const data = await res.json();
        setError(data.error || 'Failed to update status');
      }
    } catch {
      setError('Network error. Failed to update status.');
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleConnectorToggle = (type) => {
    setFormData(prev => {
      const current = prev.connector_types;
      const updated = current.includes(type) ? current.filter(t => t !== type) : [...current, type];
      return { ...prev, connector_types: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.connector_types.length === 0) return setError('Please select at least one connector type.');

    try {
      const token = getToken();
      const url = editingStation ? `${API_URL}/stations/${editingStation.id}` : `${API_URL}/stations`;
      const method = editingStation ? 'PUT' : 'POST';

      const payload = { ...formData, connector_type: formData.connector_types.join(', ') };
      delete payload.connector_types;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false); setEditingStation(null); resetForm(); fetchMyStations();
      } else {
        setError(data.error || data.errors?.[0]?.msg || 'Operation failed');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const handleEdit = (station) => {
    setEditingStation(station);
    const existingTypes = station.connector_type ? station.connector_type.split(',').map(t => t.trim()).filter(Boolean) : [];
    setFormData({
      name: station.name, address: station.address, city: station.city, state: station.state,
      zip_code: station.zip_code || '', latitude: station.latitude || '', longitude: station.longitude || '',
      connector_types: existingTypes, power_kw: station.power_kw, price_per_kw: station.price_per_kw || '',
      availability: station.availability
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this station?')) return;
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/stations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchMyStations();
      else {
        const data = await res.json();
        setError(data.error || 'Failed to delete station');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', address: '', city: '', state: '', zip_code: '', latitude: '', longitude: '',
      connector_types: [], power_kw: '', price_per_kw: '', availability: 'available'
    });
  };

  const handleCancel = () => { setShowForm(false); setEditingStation(null); resetForm(); };

  const handleGetLocation = () => {
    if (!navigator.geolocation) return setError('Geolocation is not supported by your browser');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({ 
          ...prev, 
          latitude: pos.coords.latitude.toFixed(6), 
          longitude: pos.coords.longitude.toFixed(6) 
        }));
      },
      () => setError('Unable to retrieve your location')
    );
  };

  if (loading) return <div className="dashboard-page"><div className="loading">⏳ Fetching your stations...</div></div>;

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        
        {/* ── Header ─────────────────────────────────────── */}
        <header className="admin-page-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' }}>
              🔌 My Stations Management
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
              Manage and monitor your specific charging assets across the network
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
              <b>+</b> Add New Station
            </button>
            <button className="btn-header-refresh" onClick={fetchMyStations}>🔄 Sync</button>
          </div>
        </header>

        {error && <div className="error-message">{error}</div>}

        {/* ── Form Section ───────────────────────────────── */}
        {showForm && (
          <div className="glossy-panel" id="station-form" style={{ marginBottom: '2rem' }}>
            <h3>{editingStation ? '✏️ Edit Station Configuration' : '✨ Initialize New Charging Station'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Station Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. GreenCharge City Center" />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Connector Types *</label>
                <div className="connector-types-grid">
                  {CONNECTOR_TYPES.map(type => (
                    <label key={type} className={`connector-checkbox ${formData.connector_types.includes(type) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={formData.connector_types.includes(type)} onChange={() => handleConnectorToggle(type)} />
                      🔌 {type}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Full Address *</label>
                  <input type="text" name="address" value={formData.address} onChange={handleChange} required placeholder="Street address" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City *</label>
                  <input type="text" name="city" value={formData.city} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>State *</label>
                  <input type="text" name="state" value={formData.state} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>ZIP Code</label>
                  <input type="text" name="zip_code" value={formData.zip_code} onChange={handleChange} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Latitude (for Map)</label>
                  <input type="text" inputMode="decimal" name="latitude" value={formData.latitude} onChange={handleChange} placeholder="e.g. 21.7645" />
                </div>
                <div className="form-group">
                  <label>Longitude (for Map)</label>
                  <input type="text" inputMode="decimal" name="longitude" value={formData.longitude} onChange={handleChange} placeholder="e.g. 72.1519" />
                </div>
                <div className="form-group" style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
                  <button type="button" onClick={handleGetLocation} className="btn-neutral" style={{ height: '45px', width: '100%', marginBottom: '1px' }}>
                    📍 Get Current Loc
                  </button>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginBottom: '8px' }}>
                    💡 Tip: Coordinates are needed for your station to appear on the user map.
                  </p>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Power Output (kW) *</label>
                  <input type="text" inputMode="decimal" name="power_kw" value={formData.power_kw} onChange={handleChange} required placeholder="50" />
                </div>
                <div className="form-group">
                  <label>Price (₹/kWh)</label>
                  <input type="text" inputMode="decimal" name="price_per_kw" value={formData.price_per_kw} onChange={handleChange} placeholder="8.50" />
                </div>
                <div className="form-group">
                  <label>Initial Status *</label>
                  <select name="availability" value={formData.availability} onChange={handleChange} required>
                    <option value="available">🟢 Active & Online</option>
                    <option value="unavailable">🔴 Out of Order</option>
                    <option value="maintenance">🟠 Under Service</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={handleCancel} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingStation ? '🚨 Update Station' : '🚀 Launch Station'}</button>
              </div>
            </form>
          </div>
        )}

        {/* ── Table Section ──────────────────────────────── */}
        <div className="modern-table-card">
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>🔌 My Assets</h3>
            
            <div className="admin-search-container" style={{ margin: 0, flex: 1, maxWidth: '400px' }}>
              <div className="admin-search-icon">🔍</div>
              <input 
                  type="text" 
                  placeholder="Search by name, city, state..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="admin-search-input"
              />
            </div>

            <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 700 }}>Total: {stations.length} stations</div>
          </div>
          
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Identity</th>
                  <th>Location Detail</th>
                  <th>Specifications</th>
                  <th>Live Status</th>
                  <th>Trust Level</th>
                  <th>Operations</th>
                </tr>
              </thead>
              <tbody>
                {stations.filter(s => 
                  (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                  (s.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (s.state || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (s.address || '').toLowerCase().includes(searchTerm.toLowerCase())
                ).map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 800, color: '#1e293b' }}>{s.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>UID: {s.id}</div>
                      {s.avg_rating ? (
                        <div 
                          style={{ position: 'relative', display: 'inline-block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', cursor: 'help', background: '#f8fafc', padding: '0.2rem 0.5rem', borderRadius: '4px' }}
                          onMouseEnter={() => {
                            setHoveredRatingStation(s.id);
                            fetchReviewsForHover(s.id);
                          }}
                          onMouseLeave={() => setHoveredRatingStation(null)}
                        >
                          ⭐ {s.avg_rating}/5 ({s.review_count || 0})
                          
                          {hoveredRatingStation === s.id && reviewState[String(s.id)]?.reviews?.length > 0 && (
                            <div style={{
                              position: 'absolute', top: '100%', left: '0', zIndex: 100, 
                              background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', 
                              boxShadow: '0 10px 40px rgba(0,0,0,0.15)', padding: '1rem', width: '320px',
                              marginTop: '0.5rem', pointerEvents: 'none', textAlign: 'left', cursor: 'default'
                            }}>
                              <h5 style={{ margin: '0 0 0.75rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem', fontSize: '0.95rem' }}>Customer Feedback</h5>
                              {reviewState[String(s.id)].reviews.slice(0, 3).map(r => (
                                <div key={r.id} style={{ marginBottom: '0.6rem' }}>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{r.username}</span>
                                    <span style={{ color: '#eab308' }}>{'★'.repeat(r.rating)}</span>
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem', lineHeight: '1.3', whiteSpace: 'normal' }}>{r.comment || 'No comment'}</div>
                                </div>
                              ))}
                              {reviewState[String(s.id)].reviews.length > 3 && (
                                 <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.5rem' }}>
                                   And {reviewState[String(s.id)].reviews.length - 3} more...
                                 </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                        📍 {s.address}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{s.city}, {s.state}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 700 }}>{s.power_kw} kW</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.connector_type}</div>
                      {s.price_per_kw && <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>₹{s.price_per_kw}/kWh</div>}
                    </td>
                    <td>
                      <select 
                        value={s.availability} 
                        onChange={(e) => handleStatusChange(s.id, e.target.value)}
                        style={{
                          padding: '0.4rem 0.75rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, border: '1px solid #e2e8f0',
                          background: s.availability === 'available' ? '#f0fdf4' : s.availability === 'unavailable' ? '#fef2f2' : '#fffbeb',
                          color: s.availability === 'available' ? '#15803d' : s.availability === 'unavailable' ? '#dc2626' : '#b45309'
                        }}
                      >
                        <option value="available">Available</option>
                        <option value="unavailable">Offline</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </td>
                    <td>
                      <span className={s.is_verified ? 'badge badge-green' : 'badge badge-yellow'}>
                        {s.is_verified ? '✅ Verified' : '⏳ Pending'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-neutral" style={{ padding: '0.4rem 0.8rem' }} onClick={() => handleEdit(s)}>Edit</button>
                        <button className="btn-danger" style={{ padding: '0.4rem 0.8rem' }} onClick={() => handleDelete(s.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {stations.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '5rem', color: '#94a3b8' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🍃</div>
                      <div>No stations found in your inventory.</div>
                      <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => { resetForm(); setShowForm(true); }}>
                        ➕ Add Your First Station
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerStations;
