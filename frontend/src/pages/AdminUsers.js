import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const IconUser = () => (
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

const AdminUsers = () => {
  const { getToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setUsers(data.users || []);
      else setError(data.error || 'Failed to fetch users');
    } catch {
      setError('Network error. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (id) => {
    if (!window.confirm('Are you sure you want to permanently remove this user? This action cannot be undone.')) return;
    
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
      } else {
        alert(data.error || 'Failed to remove user');
      }
    } catch {
      alert('Network error. Please try again.');
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">

        {/* Header */}
        <header className="admin-page-header">
          <div>
            <h2>👥 User Directory</h2>
            <p>View and manage all registered users on the platform.</p>
          </div>
          <button className="btn-header-refresh" onClick={fetchUsers}>
            🔄 Refresh
          </button>
        </header>

        <div className="admin-search-container">
          <div className="admin-search-icon">🔍</div>
          <input 
              type="text" 
              placeholder="Search by name, phone, email..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="admin-search-input"
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">⏳ Loading directory…</div>
        ) : users.length === 0 ? (
          <div className="no-data">No users found.</div>
        ) : (
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Joined</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => 
                  (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                  (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
                ).map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '10px',
                          background: 'linear-gradient(135deg, #f0edff, #ddd6fe)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#6C63FF', flexShrink: 0
                        }}>
                          <IconUser />
                        </div>
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{u.username?.toUpperCase()}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b' }}>
                        <IconMail /> {u.email}
                      </div>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      📅 {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <span className="badge badge-gray">👤 {u.role?.toUpperCase()}</span>
                    </td>
                    <td>
                      <button className="btn-suspend" style={{ padding: '0.4rem 0.75rem' }} onClick={() => handleRemoveUser(u.id)}>
                        Remove
                      </button>
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

export default AdminUsers;
