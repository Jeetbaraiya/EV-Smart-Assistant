import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const IconOwner = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconMail = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const AdminOwners = () => {
  const { getToken } = useAuth();
  const [owners, setOwners]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => { fetchOwners(); }, []);

  const fetchOwners = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/admin/owners`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setOwners(data.owners || []);
      else setError(data.error || 'Failed to fetch owners');
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
      const res = await fetch(`${API_URL}/admin/owners/${id}/${ep}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || `Owner ${verify ? 'approved' : 'suspended'} successfully`);
        setTimeout(() => setSuccess(''), 3000);
        fetchOwners();
      } else {
        setError(data.error || 'Operation failed');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const handleDeleteOwner = async (id) => {
    if (!window.confirm('Are you sure you want to delete this owner? This will also remove ALL their charging stations. This action cannot be undone.')) return;
    
    setError(''); setSuccess('');
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/admin/owners/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || 'Owner and their stations deleted successfully');
        setTimeout(() => setSuccess(''), 3000);
        fetchOwners();
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
            <h2>🏢 Owners Management</h2>
            <p>Verify and manage station owners on the platform.</p>
          </div>
          <button className="btn-header-refresh" onClick={fetchOwners}>
            🔄 Refresh
          </button>
        </header>

        {error   && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {loading ? (
          <div className="loading">⏳ Loading owners…</div>
        ) : owners.length === 0 ? (
          <div className="no-data">No owners found.</div>
        ) : (
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Stations</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '10px',
                          background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#0ea5e9', flexShrink: 0
                        }}>
                          <IconOwner />
                        </div>
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{o.username?.toUpperCase()}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b' }}>
                        <IconMail /> {o.email}
                      </div>
                    </td>
                    <td>
                      <span className={o.is_verified ? 'badge badge-green' : 'badge badge-yellow'}>
                        {o.is_verified ? '✅ Verified' : '⏳ Pending'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>
                        ⚡ {o.station_count || 0}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {o.is_verified ? (
                          <button className="btn-suspend" onClick={() => handleVerify(o.id, false)}>
                            Suspend
                          </button>
                        ) : (
                          <button className="btn-approve" onClick={() => handleVerify(o.id, true)}>
                            Approve
                          </button>
                        )}
                        <button className="btn-suspend" onClick={() => handleDeleteOwner(o.id)}>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path d="M5.5 5.5v7h1v-7h-1zm4 0v7h1v-7h-1z"/>
    <path fillRule="evenodd" d="M14 3H2v1h12V3zm-1 2H3l1 9a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-9zM6 1h4v1H6V1z"/>
  </svg>
  
</button>
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

export default AdminOwners;
