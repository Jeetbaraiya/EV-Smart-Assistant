import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const IconStation = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 17a4 4 0 0 0 8 0c0-4-8-8-8-8s-8 4-8 8a4 4 0 0 0 8 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="10" y1="11" x2="14" y2="11"/>
  </svg>
);

const IconOwner = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const AdminStations = () => {
  const { getToken } = useAuth();
  const [stations, setStations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => { fetchStations(); }, []);

  const fetchStations = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/admin/stations`, {
        headers: { Authorization: `Bearer ${token}` },
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

  const handleVerify = async (id, verify) => {
    setError(''); setSuccess('');
    try {
      const token = getToken();
      const ep = verify ? 'verify' : 'unverify';
      const res = await fetch(`${API_URL}/admin/stations/${id}/${ep}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || `Station ${verify ? 'approved' : 'suspended'} successfully`);
        setTimeout(() => setSuccess(''), 3000);
        fetchStations();
      } else {
        setError(data.error || 'Operation failed');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const handleDeleteStation = async (id) => {
    if (!window.confirm('Are you sure you want to delete this station? This action cannot be undone.')) return;
    
    setError(''); setSuccess('');
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/admin/stations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || 'Station deleted successfully');
        setTimeout(() => setSuccess(''), 3000);
        fetchStations();
      } else {
        setError(data.error || 'Deletion failed');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">

        {/* Header */}
        <header className="admin-page-header">
          <div>
            <h2>🔌 Station Management</h2>
            <p>Audit and verify community-added charging points.</p>
          </div>
          <button className="btn-header-refresh" onClick={fetchStations}>
            🔄 Refresh
          </button>
        </header>

        <div className="admin-search-container">
          <div className="admin-search-icon">🔍</div>
          <input 
              type="text" 
              placeholder="Search by name, location..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="admin-search-input"
          />
        </div>

        {error   && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {loading ? (
          <div className="loading">⏳ Auditing network…</div>
        ) : stations.length === 0 ? (
          <div className="no-data">No stations registered.</div>
        ) : (
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Location</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stations.filter(s => 
                  (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                  (s.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (s.state || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (s.owner_name || '').toLowerCase().includes(searchTerm.toLowerCase())
                ).map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '10px',
                          background: 'linear-gradient(135deg, #f0fdf4, #bbf7d0)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#22c55e', flexShrink: 0
                        }}>
                          <IconStation />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                            ⚡ {s.power_kw}kW | {s.connector_type}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569', fontSize: '0.85rem' }}>
                        📍 {s.city}, {s.state}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.85rem' }}>
                        <IconOwner /> {s.owner_name?.toUpperCase()}
                      </div>
                    </td>
                    <td>
                      <span className={s.is_verified ? 'badge badge-green' : 'badge badge-yellow'}>
                        {s.is_verified ? '✅ Active' : '⏳ Pending'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {s.is_verified ? (
                          <button className="btn-suspend" onClick={() => handleVerify(s.id, false)}>
                            Suspend
                          </button>
                        ) : (
                          <button className="btn-approve" onClick={() => handleVerify(s.id, true)}>
                            Approve
                          </button>
                        )}
                        {/* <button className="btn-suspend" style={{ background: '#ef4444', borderColor: '#ef4444' }} onClick={() => handleDeleteStation(s.id)}>
                          Delete
                        </button> */}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminStations;
