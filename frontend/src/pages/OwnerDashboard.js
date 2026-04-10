import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, 
  BarChart, Bar
} from 'recharts';

// ── Clean SVG Icon Components ────────────────────────────────
const IconStation = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17a4 4 0 0 0 8 0c0-4-8-8-8-8s-8 4-8 8a4 4 0 0 0 8 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="10" y1="11" x2="14" y2="11"/></svg>
);
const IconRevenue = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
);
const IconBooking = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);
const IconPower = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
);

// Mock Chart Data for fallback
const usageDataSnapshot = [
  { label: 'Mon', usage_count: 45, revenue: 1200 },
  { label: 'Tue', usage_count: 52, revenue: 1450 },
  { label: 'Wed', usage_count: 38, revenue: 980 },
  { label: 'Thu', usage_count: 65, revenue: 1900 },
  { label: 'Fri', usage_count: 48, revenue: 1300 },
  { label: 'Sat', usage_count: 72, revenue: 2200 },
  { label: 'Sun', usage_count: 61, revenue: 1800 },
];

const OwnerDashboard = () => {
  const { getToken, user } = useAuth();
  const navigate = useNavigate();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ monthlyRevenue: 0, totalBookings: 0, chartData: [] });
  const [reviewsState, setReviewsState] = useState({ reviews: [], averageRating: 0 });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => { 
    loadDashboardData();
    // Auto-refresh every 30 seconds for "real-time" data
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    await Promise.all([fetchMyStations(), fetchStats(), fetchReviews()]);
  };

  const fetchReviews = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/stations/owner/reviews`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setReviewsState({ reviews: data.reviews || [], averageRating: data.averageRating || 0 });
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/stations/owner/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

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

  // Calculate Metrics
  const totalPower = stations.reduce((sum, s) => sum + (parseFloat(s.power_kw) || 0), 0);
  const verifiedCount = stations.filter(s => s.is_verified).length;
  
  // Real stats from API with mocking fallback for visuals if completely empty
  const displayRevenue = "₹" + (stats.monthlyRevenue || 0).toLocaleString();
  const displayBookings = stats.totalBookings || 0;
  const displayChartData = stats.chartData.length > 0 ? stats.chartData : usageDataSnapshot;

  if (loading) return <div className="dashboard-page"><div className="loading">⏳ Synchronizing command center data...</div></div>;

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        
        {/* ── Header ─────────────────────────────────────── */}
        <header className="admin-page-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' }}>
              🔋 Owner Command Center
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
              Real-time monitoring and network performance analytics
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className={user?.is_verified ? 'badge badge-green' : 'badge badge-yellow'}>
              {user?.is_verified ? '● Verified Account' : '● Verification Pending'}
            </span>
            <button className="btn-header-refresh" onClick={loadDashboardData}>🔄 Sync</button>
          </div>
        </header>

        {error && <div className="error-message">{error}</div>}

        {/* ── KPI Grid ───────────────────────────────────── */}
        <div className="stats-grid">
          <div className="stat-card kpi-stations">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-value">{stations.length}</div>
                <div className="stat-label">My Stations</div>
                <div className="stat-sublabel">{verifiedCount} active on network</div>
              </div>
              <div className="quick-action-icon"><IconStation /></div>
            </div>
          </div>

          <div className="stat-card kpi-revenue">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-value">{displayRevenue}</div>
                <div className="stat-label">Monthly Revenue</div>
                <div className="stat-sublabel">Live database earnings</div>
              </div>
              <div className="quick-action-icon" style={{ background: '#ecfdf5', color: '#10b981' }}><IconRevenue /></div>
            </div>
          </div>

          <div className="stat-card kpi-bookings">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-value">{displayBookings}</div>
                <div className="stat-label">Active Bookings</div>
                <div className="stat-sublabel">Total sessions this month</div>
              </div>
              <div className="quick-action-icon" style={{ background: '#f5f3ff', color: '#8b5cf6' }}><IconBooking /></div>
            </div>
          </div>

          <div className="stat-card kpi-capacity">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-value">{totalPower} kW</div>
                <div className="stat-label">Total Capacity</div>
                <div className="stat-sublabel">Combined grid power</div>
              </div>
              <div className="quick-action-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}><IconPower /></div>
            </div>
          </div>
        </div>

        {/* ── Quick Actions ──────────────────────────────── */}
        <div className="quick-actions-grid">
          <div className="quick-action-card" onClick={() => navigate('/owner/my-stations')}>
            <div className="quick-action-icon">➕</div>
            <div className="quick-action-info">
              <h4>Add Station</h4>
              <p>Expand your network</p>
            </div>
          </div>
          <div className="quick-action-card" onClick={() => navigate('/owner/my-stations')}>
            <div className="quick-action-icon" style={{ color: '#10b981', background: '#ecfdf5' }}>📊</div>
            <div className="quick-action-info">
              <h4>Manage Assets</h4>
              <p>View & update inventory</p>
            </div>
          </div>
          <div className="quick-action-card">
            <div className="quick-action-icon" style={{ color: '#f59e0b', background: '#fffbeb' }}>🛡️</div>
            <div className="quick-action-info">
              <h4>Support</h4>
              <p>Contact Admin</p>
            </div>
          </div>
        </div>

        {/* ── Charts Section ─────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div className="chart-panel">
            <h4>📈 Revenue & Usage Performance (Last 14 Days)</h4>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={displayChartData}>
                <defs>
                  <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6C63FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} 
                  labelStyle={{ fontWeight: 800, color: '#1e293b' }}
                />
                <Area type="monotone" name="Usage Events" dataKey="usage_count" stroke="#6C63FF" strokeWidth={3} fillOpacity={1} fill="url(#colorUsage)" />
                <Area type="monotone" name="Revenue (₹)" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-panel">
            <h4>🔌 Utilization Break-down</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={displayChartData.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip cursor={{fill: '#f8faff'}} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Bar name="Daily Sessions" dataKey="usage_count" fill="#6C63FF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Reviews Section ────────────────────────────── */}
        <div className="reviews-panel" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>⭐ Station Reviews</h4>
            {reviewsState.averageRating > 0 && (
              <span style={{ background: '#fffbeb', color: '#f59e0b', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: 800, fontSize: '0.9rem' }}>
                Average Network Rating: {reviewsState.averageRating} / 5.0
              </span>
            )}
          </div>
          
          {reviewsState.reviews.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No reviews yet for your stations.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {[...reviewsState.reviews].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(review => (
                <div key={review.id} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <div>
                      <strong style={{ color: '#1e293b', display: 'block' }}>{review.username?.toUpperCase()}</strong>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>at {review.station_name}</span>
                    </div>
                    <span style={{ color: '#eab308' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                  </div>
                  <p style={{ margin: '0.5rem 0', color: '#475569', fontSize: '0.9rem', lineHeight: '1.4' }}>{review.comment || 'No comment provided.'}</p>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right' }}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;
