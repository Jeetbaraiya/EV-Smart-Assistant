import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// ── Clean SVG Icon Components ────────────────────────────────
const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconOwner = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconStation = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 17a4 4 0 0 0 8 0c0-4-8-8-8-8s-8 4-8 8a4 4 0 0 0 8 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="10" y1="11" x2="14" y2="11"/>
  </svg>
);



const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const AdminDashboard = () => {
  const { getToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const fetchStats = useCallback(async (isRefresh = false) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setStats(data.stats);
      } else {
        setError(data.error || 'Failed to fetch statistics');
      }
    } catch (err) {
      if (!isRefresh) setError('Network error. Please check if the server is running.');
    }
  }, [getToken, API_URL]);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      await fetchStats(isRefresh);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, [fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh stats every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);


  return (
    <div className="dashboard-page">
      <div className="dashboard-container">

        {/* ── Header ─────────────────────────────────────── */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '2rem', paddingBottom: '1.5rem',
          borderBottom: '1px solid #e8eef8'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' }}>
              ⚡ Admin Command Center
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
              Real-time analytics for the India EV Charging Network
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
              padding: '0.35rem 0.85rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700
            }}>● Live</span>
            <button onClick={() => fetchData()} style={{
              background: 'linear-gradient(135deg, #6C63FF, #5a52d5)',
              color: 'white', border: 'none', padding: '0.6rem 1.25rem',
              borderRadius: '12px', fontWeight: 600, cursor: 'pointer',
              fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
              boxShadow: '0 4px 12px rgba(108,99,255,0.3)', transition: 'all 0.2s'
            }}>🔄 Refresh</button>
          </div>
        </header>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">Analyzing platform data...</div>
        ) : (
          <>
            {stats ? (
              <>
                {/* ── Stat Cards ─────────────────────────────── */}
                <div className="stats-grid">
                  <div className="stat-card" style={{ borderTop: '4px solid #6C63FF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.03em' }}>
                          {stats.totalUsers || 0}
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginTop: '0.25rem' }}>Total Users</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>Registered accounts</div>
                      </div>
                      <div style={{
                        width: 48, height: 48, borderRadius: '14px',
                        background: 'linear-gradient(135deg, #f0edff, #ddd6fe)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#6C63FF', flexShrink: 0
                      }}>
                        <IconUsers />
                      </div>
                    </div>
                  </div>

                  <div className="stat-card" style={{ borderTop: '4px solid #0ea5e9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.03em' }}>
                          {stats.totalOwners || 0}
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginTop: '0.25rem' }}>Station Owners</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                          {stats.verifiedOwners || 0} verified · {stats.pendingOwners || 0} pending
                        </div>
                      </div>
                      <div style={{
                        width: 48, height: 48, borderRadius: '14px',
                        background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#0ea5e9', flexShrink: 0
                      }}>
                        <IconOwner />
                      </div>
                    </div>
                  </div>

                  <div className="stat-card" style={{ borderTop: '4px solid #22c55e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.03em' }}>
                          {stats.totalStations || 0}
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginTop: '0.25rem' }}>Network Points</div>
                      </div>
                      <div style={{
                        width: 48, height: 48, borderRadius: '14px',
                        background: 'linear-gradient(135deg, #f0fdf4, #bbf7d0)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#22c55e', flexShrink: 0
                      }}>
                        <IconStation />
                      </div>
                    </div>
                  </div>

                  <div className="stat-card" style={{ borderTop: '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.03em' }}>
                          {stats.verifiedStations || 0}
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginTop: '0.25rem' }}>Verified Stations</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                          {stats.pendingStations || 0} awaiting approval
                        </div>
                      </div>
                      <div style={{
                        width: 48, height: 48, borderRadius: '14px',
                        background: 'linear-gradient(135deg, #fffbeb, #fde68a)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#f59e0b', flexShrink: 0
                      }}>
                        <IconClock />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── second row: power + summary ────────────── */}
                <div className="admin-dashboard-row">
                  {/* Power capacity card */}
                  <div className="stat-card" style={{
                    background: 'linear-gradient(135deg, #6C63FF 0%, #4f46e5 100%)',
                    color: 'white', borderTop: 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                          {stats.totalPowerCapacity || 0}
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.85, marginTop: '0.25rem' }}>Total Output (kW)</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.65, marginTop: '0.35rem' }}>Combined grid capacity</div>
                      </div>
                      <div style={{ opacity: 0.9, fontSize: '2rem' }}>⚡</div>
                    </div>
                  </div>

                  {/* Platform health summary */}
                  <div className="stat-card" style={{ borderTop: 'none', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 120, textAlign: 'center' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#22c55e' }}>
                        {stats.totalStations > 0 ? Math.round((stats.verifiedStations / stats.totalStations) * 100) : 0}%
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginTop: '0.2rem' }}>Verification Rate</div>
                    </div>
                    <div style={{ width: 1, height: 56, background: '#e2e8f0' }} />
                    <div style={{ flex: 1, minWidth: 120, textAlign: 'center' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#6C63FF' }}>
                        {stats.totalOwners > 0 ? Math.round((stats.verifiedOwners / stats.totalOwners) * 100) : 0}%
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginTop: '0.2rem' }}>Owner Approval Rate</div>
                    </div>
                    <div style={{ width: 1, height: 56, background: '#e2e8f0' }} />
                    <div style={{ flex: 1, minWidth: 120, textAlign: 'center' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b' }}>
                        {stats.pendingStations || 0}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginTop: '0.2rem' }}>Needs Review</div>
                    </div>
                  </div>
                </div>

                {/* ── Charts ─────────────────────────────────── */}
                <div className="admin-dashboard-chart-row">
                  <div className="stat-card" style={{ borderTop: 'none' }}>
                    <h4 style={{ margin: '0 0 1.25rem', fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>📈 Usage Trend</h4>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={stats.routeUsageTrend} barSize={28}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="day" 
                          tick={{ fontSize: 11, fill: '#94a3b8' }} 
                          axisLine={false} 
                          tickLine={false}
                          tickFormatter={(str) => {
                            if (!str) return '';
                            try {
                              return new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                            } catch (e) { return str; }
                          }}
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }} 
                        />
                        <Bar dataKey="count" fill="#6C63FF" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="stat-card" style={{ borderTop: 'none' }}>
                    <h4 style={{ margin: '0 0 1.25rem', fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>🔌 Station Status</h4>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Available', value: stats.stationStatusDistribution?.available || 0 },
                            { name: 'Busy', value: stats.stationStatusDistribution?.busy || 0 },
                            { name: 'Offline', value: stats.stationStatusDistribution?.offline || 0 }
                          ]}
                          dataKey="value"
                          outerRadius={90}
                          innerRadius={50}
                          paddingAngle={4}
                        >
                          <Cell fill="#22c55e" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                        <Legend iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>


              </>
            ) : (
              <div className="no-data">No statistics available.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
