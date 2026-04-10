import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './MyBookings.css'; // Reusing identical high-quality UI styles

const STATUS_META = {
  confirmed: { icon: '✅', label: 'Confirmed', color: '#22c55e' },
  pending:   { icon: '⏳', label: 'Pending',   color: '#f59e0b' },
  completed: { icon: '🏁', label: 'Completed', color: '#3b82f6' },
  cancelled: { icon: '❌', label: 'Cancelled', color: '#ef4444' },
};

const OwnerBookings = () => {
  const { getToken } = useAuth();
  const [bookings, setBookings]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const fetchOwnerBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/bookings/owner-bookings`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) {
        setBookings(data.bookings || []);
      } else {
        setError(data.error || 'Failed to fetch station bookings.');
      }
    } catch {
      setError('Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [API_URL, getToken]);

  useEffect(() => { fetchOwnerBookings(); }, [fetchOwnerBookings]);

  // Handle specific formatting like "Tue, 7 Apr, 07:30 am" and append Z to enforce UTC.
  const fmt = (dateStr) => {
    if (!dateStr) return '—';
    const isoString = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const d = new Date(isoString.endsWith('Z') ? isoString : isoString + 'Z');
    
    if (isNaN(d.getTime())) return dateStr;

    try {
        return new Intl.DateTimeFormat('en-IN', { 
            weekday: 'short', day: 'numeric', month: 'short', 
            hour: '2-digit', minute: '2-digit', hour12: true,
            timeZone: 'Asia/Kolkata' 
        }).format(d);
    } catch (e) {
        return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    }
  };

  const durationMins = (start, end) => {
    if (!start || !end) return null;
    const diff = Math.round((new Date(end) - new Date(start)) / 60000);
    if (diff <= 0) return null;
    return diff >= 60
      ? `${Math.floor(diff / 60)}h ${diff % 60 > 0 ? diff % 60 + 'm' : ''}`.trim()
      : `${diff}m`;
  };

  const now = new Date();

  // Dynamically calculate status based on time
  const processedBookings = bookings.map(b => {
    let status = b.status?.toLowerCase();
    const endTime = b.end_time ? (b.end_time.includes('T') ? new Date(b.end_time.endsWith('Z') ? b.end_time : b.end_time + 'Z') : new Date(b.end_time.replace(' ', 'T') + 'Z')) : null;
    
    // If it's a confirmed booking but the end time has passed, show it as completed
    if (status === 'confirmed' && endTime && endTime < now) {
      status = 'completed';
    }
    return { ...b, displayStatus: status };
  });

  const counts = processedBookings.reduce((acc, b) => {
    const s = b.displayStatus || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const handleDeleteBooking = async (id) => {
    if (!window.confirm('Hide this session from your history?')) return;
    try {
      const res = await fetch(`${API_URL}/bookings/manage/owner/delete/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setBookings(prev => prev.filter(b => b.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to remove session');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleClearHistory = async () => {
    const pastBookings = processedBookings.filter(b => 
      ['cancelled', 'completed'].includes(b.displayStatus)
    );

    if (pastBookings.length === 0) {
      alert('No past sessions to clear.');
      return;
    }

    if (!window.confirm(`Hide all ${pastBookings.length} past sessions from your history? \n(This will not affect the customer's view)`)) return;
    
    try {
      const res = await fetch(`${API_URL}/bookings/manage/owner/clear-all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        fetchOwnerBookings(); // Refresh list
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to clear history');
      }
    } catch {
      alert('Network error');
    }
  };

  if (loading) {
    return (
      <div className="my-bookings-container">
        <div className="bookings-loading">
          <div className="bookings-spinner" />
          <p>Loading station bookings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-bookings-container">
      <div className="bookings-header">
        <div className="bookings-header-left">
          <h1>📊 Station Reservations</h1>
          <p>Track all charging sessions booked at your properties.</p>
        </div>
        <div className="bookings-header-actions">
           <button className="bookings-refresh-btn" onClick={fetchOwnerBookings} style={{ marginRight: '0.75rem' }}>
            🔄 Refresh
          </button>
          <button className="clear-all-btn" onClick={handleClearHistory} title="Hide past sessions">
            🗑️ Clear History
          </button>
        </div>
      </div>

      {processedBookings.length > 0 && (
        <div className="bookings-summary-pills">
          <span className="pill total">{processedBookings.length} Total Bookings</span>
          {counts.confirmed  && <span className="pill confirmed">{counts.confirmed} Active</span>}
          {counts.completed  && <span className="pill completed">{counts.completed} Completed</span>}
          {counts.cancelled  && <span className="pill cancelled">{counts.cancelled} Cancelled</span>}
        </div>
      )}

      {error && <div className="bookings-error-banner">⚠️ {error}</div>}

      {processedBookings.length === 0 && !error ? (
        <div className="no-bookings-card">
          <div className="no-bookings-icon">📋</div>
          <h3>No bookings found</h3>
          <p>There are no current reservations for any of your charging stations.</p>
        </div>
      ) : (
        <div className="bookings-list">
          {[...processedBookings].sort((a, b) => b.id - a.id).map(booking => {
            const sm = STATUS_META[booking.displayStatus] || STATUS_META.pending;
            const dur = durationMins(booking.start_time, booking.end_time);
            const connType = booking.connector_type || booking.connector_type_label || null;
            const connPower = booking.connector_power || null;
            
            const isPastStatus = ['cancelled', 'completed'].includes(booking.displayStatus);

            return (
              <div key={booking.id} className={`booking-card status-${booking.displayStatus}`}>
                <div className="booking-status-badge" style={{ background: sm.color }}>
                   {sm.icon} {booking.displayStatus === 'completed' ? 'Completed' : sm.label}
                </div>

                <div className="bc-station-banner" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 60%)', borderLeft: '3px solid #22c55e' }}>
                  <div className="bc-station-icon" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>⚡</div>
                  <div className="bc-station-details">
                    <h3 className="bc-station-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {booking.station_name || `Station #${booking.station_id}`}
                      {isPastStatus && (
                        <button 
                          className="delete-item-btn" 
                          onClick={() => handleDeleteBooking(booking.id)}
                          title="Remove from history"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: '0.6' }}
                        >
                          &times;
                        </button>
                      )}
                    </h3>
                    {booking.station_address && (
                      <p className="bc-station-addr" style={{ color: '#16a34a' }}>
                        📍 {booking.station_address}
                        {booking.station_city ? `, ${booking.station_city}` : ''}
                        {booking.station_state ? `, ${booking.station_state}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="booking-details-grid" style={{ paddingBottom: '0.5rem' }}>
                  <div className="detail-item">
                    <span className="detail-label">Customer</span>
                    <span className="detail-value">{booking.user_name || 'Guest User'}</span>
                    {booking.user_email && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{booking.user_email}</span>}
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">START</span>
                    <span className="detail-value">{fmt(booking.start_time)}</span>
                  </div>
                  {booking.end_time && (
                    <div className="detail-item">
                      <span className="detail-label">END</span>
                      <span className="detail-value">{fmt(booking.end_time)}</span>
                    </div>
                  )}
                  {dur && (
                    <div className="detail-item">
                      <span className="detail-label">DURATION</span>
                      <span className="detail-value">⏱ {dur}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">CONNECTOR</span>
                    <span className="detail-value">
                      {connType ? <>🔌 {connType}{connPower ? ` (${connPower}kW)` : ''}</> : '—'}
                    </span>
                  </div>
                  {booking.energy_kwh > 0 && (
                    <div className="detail-item">
                      <span className="detail-label">ENERGY</span>
                      <span className="detail-value">⚡ {Number(booking.energy_kwh).toFixed(1)} kWh</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">EST. COST</span>
                    <span className="detail-value highlight">
                      ₹{Number(booking.total_price || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OwnerBookings;
