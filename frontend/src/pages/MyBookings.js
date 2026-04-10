import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './MyBookings.css';

const STATUS_META = {
  confirmed: { icon: '✅', label: 'Confirmed', color: '#22c55e' },
  pending: { icon: '⏳', label: 'Pending', color: '#f59e0b' },
  completed: { icon: '🏁', label: 'Completed', color: '#3b82f6' },
  cancelled: { icon: '❌', label: 'Cancelled', color: '#ef4444' },
};

const MyBookings = () => {
  const { getToken } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/bookings/my-bookings`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) {
        setBookings(data.bookings || []);
      } else {
        setError(data.error || 'Failed to fetch bookings.');
      }
    } catch {
      setError('Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [API_URL, getToken]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this reservation?')) return;
    setCancellingId(id);
    try {
      const res = await fetch(`${API_URL}/bookings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        // Use loose equality for safety and update local state immediately
        setBookings(prev => prev.map(b => String(b.id) === String(id) ? { ...b, status: 'cancelled' } : b));
        // Also refresh to ensure derived displayStatus logic and summary counts are updated
        fetchBookings();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to cancel booking');
      }
    } catch {
      alert('Network error');
    } finally {
      setCancellingId(null);
    }
  };

  const handleDeleteHistory = async (id) => {
    if (!window.confirm('Remove this session from your history?')) return;
    try {
      const res = await fetch(`${API_URL}/bookings/manage/delete/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) {
        setBookings(prev => prev.filter(b => b.id != id));
      } else {
        alert(data.error || 'Failed to delete history');
      }
    } catch (e) {
      console.error('Delete error:', e);
      alert('Network error - could not reach server');
    }
  };

  const handleClearAllHistory = async () => {
    if (!window.confirm('This will permanently delete ALL your past sessions. Are you sure?')) return;
    try {
      const res = await fetch(`${API_URL}/bookings/manage/clear-all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) {
        fetchBookings();
        alert(data.message || 'History cleared!');
      } else {
        alert(data.error || 'Failed to clear history');
      }
    } catch (e) {
      console.error('Clear All error:', e);
      alert('Network error - could not reach server');
    }
  };

  const fmt = (dateStr) => {
    if (!dateStr) return '—';
    // Ensure standard ISO UTC tracking by replacing space with T and appending Z if missing
    const isoString = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const d = new Date(isoString.endsWith('Z') ? isoString : isoString + 'Z');

    if (isNaN(d.getTime())) return dateStr;

    try {
      // Use Intl.DateTimeFormat for bulletproof timezone-aware formatting
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

  /* ── group bookings by displayStatus for summary counts ── */
  const counts = processedBookings.reduce((acc, b) => {
    const s = b.displayStatus || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="my-bookings-container">
        <div className="bookings-loading">
          <div className="bookings-spinner" />
          <p>Loading your sessions…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-bookings-container">

      {/* ── Header ── */}
      <div className="bookings-header">
        <div className="bookings-header-left">
          <h1>⚡ My Charging Sessions</h1>
          <p>Manage your upcoming and past reservations.</p>
        </div>
        <div className="bookings-header-right">
          <button className="bookings-refresh-btn" onClick={fetchBookings}>
            🔄 Refresh
          </button>
          {processedBookings.some(b => b.displayStatus !== 'confirmed') && (
            <button className="clear-all-btn" onClick={handleClearAllHistory}>
              🗑️ Clear History
            </button>
          )}
        </div>
      </div>

      {/* ── Summary pills ── */}
      {processedBookings.length > 0 && (
        <div className="bookings-summary-pills">
          <span className="pill total">{processedBookings.length} Total</span>
          {counts.confirmed && <span className="pill confirmed">{counts.confirmed} Active</span>}
          {counts.completed && <span className="pill completed">{counts.completed} Completed</span>}
          {counts.cancelled && <span className="pill cancelled">{counts.cancelled} Cancelled</span>}
        </div>
      )}

      {error && <div className="bookings-error-banner">⚠️ {error}</div>}

      {processedBookings.length === 0 && !error ? (
        <div className="no-bookings-card">
          <div className="no-bookings-icon">📅</div>
          <h3>No bookings yet</h3>
          <p>Reserve a slot at any charging station to see it here.</p>
          <a href="/stations" className="book-now-btn">⚡ Find Stations</a>
        </div>
      ) : (
        <div className="bookings-list">
          {[...processedBookings].sort((a, b) => b.id - a.id).map(booking => {
            const sm = STATUS_META[booking.displayStatus] || STATUS_META.pending;
            const dur = durationMins(booking.start_time, booking.end_time);
            const connType = booking.connector_type || booking.connector_type_label || null;
            const connPower = booking.connector_power || null;

            // Robust parsing and comparison
            const isoString = booking.start_time.includes('T') ? booking.start_time : booking.start_time.replace(' ', 'T');
            const d = new Date(isoString.endsWith('Z') ? isoString : isoString + 'Z');
            const isPastSlot = d < now;

            return (
              <div key={booking.id} className={`booking-card status-${booking.displayStatus}`}>

                {/* Status badge */}
                <div className="booking-status-badge" style={{ background: sm.color }}>
                  {sm.icon} {booking.displayStatus === 'completed' ? 'Completed' : sm.label}
                </div>

                {/* ── Station identity ── */}
                <div className="bc-station-banner">
                  <div className="bc-station-icon">⚡</div>
                  <div className="bc-station-details">
                    <h3 className="bc-station-name">
                      {booking.station_name || `Station #${booking.station_id}`}
                    </h3>
                    {booking.station_address && (
                      <p className="bc-station-addr">
                        📍 {booking.station_address}
                        {booking.station_city ? `, ${booking.station_city}` : ''}
                        {booking.station_state ? `, ${booking.station_state}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Details grid ── */}
                <div className="booking-details-grid">
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
                      {connType
                        ? <>🔌 {connType}{connPower ? ` (${connPower} kW)` : ''}</>
                        : '—'}
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

                {/* ── Actions ── */}
                <div className="booking-card-actions">
                  {booking.displayStatus === 'confirmed' && !isPastSlot && (
                    <button
                      className="cancel-booking-btn"
                      onClick={() => handleCancel(booking.id)}
                      disabled={cancellingId === booking.id}
                    >
                      {cancellingId === booking.id ? '⏳ Working…' : '❌ Cancel Reservation'}
                    </button>
                  )}
                  {booking.displayStatus === 'confirmed' && isPastSlot && (
                    <div className="action-row-status">
                      <span className="status-note" style={{ color: '#f59e0b', fontWeight: '500' }}>🔒 Time slot passed - Cannot be cancelled</span>
                      <button className="delete-history-btn" onClick={() => handleDeleteHistory(booking.id)}>
                        🗑️ Delete History
                      </button>
                    </div>
                  )}
                  {booking.displayStatus === 'cancelled' && (
                    <div className="action-row-status">
                      <span className="status-note">This reservation was cancelled</span>
                      <button className="delete-history-btn" onClick={() => handleDeleteHistory(booking.id)}>
                        🗑️ Delete History
                      </button>
                    </div>
                  )}
                  {booking.displayStatus === 'completed' && (
                    <div className="action-row-status">
                      <span className="status-note">✅ Session completed successfully</span>
                      <button className="delete-history-btn" onClick={() => handleDeleteHistory(booking.id)}>
                        🗑️ Delete History
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyBookings;
