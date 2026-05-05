import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';
import './AdminBookings.css';

// ── Icons ──────────────────────────────────────────────────────────────────
const IconBooking = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconSearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconFilter = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);
const IconDownload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IconSort = ({ dir }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {dir === 'asc'
      ? <polyline points="18 15 12 9 6 15"/>
      : <polyline points="6 9 12 15 18 9"/>}
  </svg>
);
const IconChevronLeft  = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const IconChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dt; }
};
const fmtTime = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return dt; }
};

// ── Status Badge Component (Renamed to avoid collision) ──────────────────
const BookingStatusBadge = ({ status }) => {
  const statusMap = {
    confirmed: { cls: 'badge-booking-confirmed', label: 'Confirmed', icon: '✅', color: '#15803d', bg: '#f0fdf4' },
    cancelled: { cls: 'badge-booking-cancelled', label: 'Cancelled', icon: '❌', color: '#dc2626', bg: '#fef2f2' },
    completed: { cls: 'badge-booking-completed', label: 'Completed', icon: '🏁', color: '#1d4ed8', bg: '#eff6ff' },
    pending:   { cls: 'badge-booking-pending',   label: 'Pending',   icon: '⏳', color: '#b45309', bg: '#fffbeb' },
  };

  const rawStatus = (status || 'pending').toString().toLowerCase().trim();
  const cfg = statusMap[rawStatus] || statusMap.pending;

  return (
    <span 
      className={`admin-status-pill ${cfg.cls}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.3rem 0.75rem',
        borderRadius: '50px',
        fontSize: '0.75rem',
        fontWeight: '700',
        whiteSpace: 'nowrap',
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}33`,
        position: 'relative',
        zIndex: 1
      }}
    >
      <span className="badge-icon" style={{ fontSize: '0.85rem' }}>{cfg.icon}</span>
      <span className="badge-text">{cfg.label}</span>
    </span>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
const AdminBookings = () => {
  const { getToken } = useAuth();
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Data state
  const [bookings,   setBookings]   = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [stats,      setStats]      = useState({ total: 0, confirmed: 0, completed: 0, cancelled: 0 });
  const [stations,   setStations]   = useState([]);

  // Filter state
  const [search,    setSearch]    = useState('');
  const [dateFilter,setDateFilter]= useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [sort,      setSort]      = useState('date_desc');
  const [page,      setPage]      = useState(1);

  // UI state
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState('');
  const [exporting, setExporting] = useState(false);
  const searchTimer = useRef(null);

  // ── Fetch bookings ──────────────────────────────────────────────────────
  const fetchBookings = useCallback(async (opts = {}) => {
    const p = opts.page ?? page;
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const params = new URLSearchParams({
        page:    p,
        limit:   20,
        sort,
        ...(search       && { search }),
        ...(dateFilter   && { date: dateFilter }),
        ...(stationFilter && { station_id: stationFilter }),
        ...(statusFilter  && { status: statusFilter }),
      });
      const res  = await fetch(`${API_URL}/admin/bookings?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setBookings(data.bookings || []);
        setPagination(data.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
      } else {
        setError(data.error || 'Failed to fetch bookings');
      }
    } catch {
      setError('Network error. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  }, [getToken, API_URL, page, sort, search, dateFilter, stationFilter, statusFilter]);

  // ── Fetch analytics stats ───────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const token = getToken();
      const res   = await fetch(`${API_URL}/admin/bookings/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data  = await res.json();
      if (res.ok) setStats(data.stats);
    } catch { /* silent */ }
  }, [getToken, API_URL]);

  // ── Fetch station list for filter dropdown ──────────────────────────────
  const fetchStations = useCallback(async () => {
    try {
      const token = getToken();
      const res   = await fetch(`${API_URL}/admin/bookings/stations-list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data  = await res.json();
      if (res.ok) setStations(data.stations || []);
    } catch { /* silent */ }
  }, [getToken, API_URL]);

  useEffect(() => { fetchStats(); fetchStations(); }, [fetchStats, fetchStations]);

  // Re-fetch whenever sort/filters/page change
  useEffect(() => { fetchBookings(); }, [sort, dateFilter, stationFilter, statusFilter, page]); // eslint-disable-line

  // Debounce search
  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchBookings({ page: 1 });
    }, 450);
  };

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const handleSort = (key) => {
    setSort(prev => {
      if (prev === `${key}_desc`) return `${key}_asc`;
      if (prev === `${key}_asc`)  return `${key}_desc`;
      return `${key}_desc`;
    });
    setPage(1);
  };

  const getSortDir = (key) => {
    if (sort === `${key}_desc`) return 'desc';
    if (sort === `${key}_asc`)  return 'asc';
    return null;
  };

  const clearFilters = () => {
    setSearch(''); setDateFilter(''); setStationFilter('');
    setStatusFilter(''); setSort('date_desc'); setPage(1);
  };

  // ── CSV Export ──────────────────────────────────────────────────────────
  const exportCSV = async () => {
    setExporting(true);
    try {
      const token  = getToken();
      const params = new URLSearchParams({
        limit: 1000, sort,
        ...(search        && { search }),
        ...(dateFilter    && { date: dateFilter }),
        ...(stationFilter && { station_id: stationFilter }),
        ...(statusFilter  && { status: statusFilter }),
      });
      const res  = await fetch(`${API_URL}/admin/bookings?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return;

      const rows = data.bookings || [];
      const headers = ['Booking ID','User Name','Email','Station','City','Date','Start Time','End Time','Status','Energy (kWh)','Price (₹)','Connector'];
      const csvRows = [
        headers.join(','),
        ...rows.map(b => [
          b.id,
          `"${b.user_name  || 'N/A'}"`,
          `"${b.user_email || 'N/A'}"`,
          `"${b.station_name || b.station_id}"`,
          `"${b.station_city || ''}"`,
          fmt(b.start_time),
          fmtTime(b.start_time),
          fmtTime(b.end_time),
          b.status,
          b.energy_kwh ?? '',
          b.total_price ?? '',
          `"${b.connector_type_label || (b.connector_id ? `#${b.connector_id}` : 'N/A')}"`,
        ].join(',')),
      ];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `admin-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ } finally {
      setExporting(false);
    }
  };

  const activeFilters = [search, dateFilter, stationFilter, statusFilter].filter(Boolean).length;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-page">
      <div className="dashboard-container">

        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="admin-page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div className="ab-header-icon"><IconBooking /></div>
            <div>
              <h2 style={{ margin: 0 }}>📋 All Bookings</h2>
              <p style={{ margin: 0 }}>Platform-wide booking records across all stations</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button className="ab-export-btn" onClick={exportCSV} disabled={exporting}>
              <IconDownload />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
            <button className="btn-header-refresh" onClick={() => fetchBookings()}>
              🔄 Refresh
            </button>
          </div>
        </header>

        {/* ── Analytics Cards ─────────────────────────────────────── */}
        {stats && (
          <div className="ab-stats-row">
            {[
              { label: 'Total Bookings', value: Number(stats.total || 0),     color: '#6C63FF', bg: 'linear-gradient(135deg,#f0edff,#ddd6fe)' },
              { label: 'Confirmed',      value: Number(stats.confirmed || 0), color: '#16a34a', bg: 'linear-gradient(135deg,#f0fdf4,#bbf7d0)' },
              { label: 'Completed',      value: Number(stats.completed || 0), color: '#0ea5e9', bg: 'linear-gradient(135deg,#e0f2fe,#bae6fd)' },
              { label: 'Cancelled',      value: Number(stats.cancelled || 0), color: '#ef4444', bg: 'linear-gradient(135deg,#fef2f2,#fecaca)' },
            ].map(s => (
              <div className="ab-stat-card" key={s.label}>
                <div className="ab-stat-value" style={{ color: s.color }}>{s.value.toLocaleString()}</div>
                <div className="ab-stat-label">{s.label}</div>
                <div className="ab-stat-bar" style={{ background: s.bg }} />
              </div>
            ))}
          </div>
        )}

        {/* ── Filters & Search ────────────────────────────────────── */}
        <div className="ab-filters-panel">
          {/* Search */}
          <div className="ab-search-wrapper">
            <span className="ab-search-icon"><IconSearch /></span>
            <input
              id="admin-bookings-search"
              type="text"
              className="ab-search-input"
              placeholder="Search by user, email or station…"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>

          {/* Date filter */}
          <div className="ab-filter-group">
            <label className="ab-filter-label">📅 Date</label>
            <input
              id="admin-bookings-date"
              type="date"
              className="ab-filter-control"
              value={dateFilter}
              onChange={handleFilterChange(setDateFilter)}
            />
          </div>

          {/* Station filter */}
          <div className="ab-filter-group">
            <label className="ab-filter-label">🏪 Station</label>
            <select
              id="admin-bookings-station"
              className="ab-filter-control"
              value={stationFilter}
              onChange={handleFilterChange(setStationFilter)}
            >
              <option value="">All Stations</option>
              {stations.map(s => (
                <option key={s.station_id} value={s.station_id}>{s.station_name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="ab-filter-group">
            <label className="ab-filter-label">🔖 Status</label>
            <select
              id="admin-bookings-status"
              className="ab-filter-control"
              value={statusFilter}
              onChange={handleFilterChange(setStatusFilter)}
            >
              <option value="">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Sort */}
          <div className="ab-filter-group">
            <label className="ab-filter-label">↕ Sort</label>
            <select
              id="admin-bookings-sort"
              className="ab-filter-control"
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(1); }}
            >
              <option value="date_desc">Date ↓ (Newest)</option>
              <option value="date_asc">Date ↑ (Oldest)</option>
              <option value="status">Status A–Z</option>
              <option value="station">Station A–Z</option>
            </select>
          </div>

          {/* Clear filters */}
          {activeFilters > 0 && (
            <button className="ab-clear-btn" onClick={clearFilters}>
              <IconFilter /> Clear ({activeFilters})
            </button>
          )}
        </div>

        {/* ── Result count ────────────────────────────────────────── */}
        <div className="ab-result-bar">
          <span className="ab-result-count">
            {loading ? 'Loading…' : `${pagination.total} booking${pagination.total !== 1 ? 's' : ''} found`}
          </span>
          {pagination.totalPages > 1 && (
            <span className="ab-page-info">
              Page {pagination.page} of {pagination.totalPages}
            </span>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* ── Table ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="loading">⏳ Loading bookings…</div>
        ) : bookings.length === 0 ? (
          <div className="no-data">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>No bookings found</div>
            {activeFilters > 0 && (
              <button className="ab-clear-btn" style={{ marginTop: '1rem' }} onClick={clearFilters}>
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="ab-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>User</th>
                  <th>Station</th>
                  <th
                    className="ab-sortable-th"
                    onClick={() => handleSort('date')}
                    title="Sort by date"
                  >
                    Date
                    {getSortDir('date') && (
                      <span className="ab-sort-icon"><IconSort dir={getSortDir('date')} /></span>
                    )}
                  </th>
                  <th>Time Slot</th>
                  <th>Connector</th>
                  <th>Energy / Price</th>
                  <th
                    className="ab-sortable-th"
                    onClick={() => setSort(s => s === 'status' ? 'date_desc' : 'status')}
                    title="Sort by status"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id}>
                    {/* ID */}
                    <td>
                      <span className="ab-booking-id">#{b.id}</span>
                    </td>

                    {/* User */}
                    <td>
                      <div className="ab-user-cell">
                        <div className="ab-user-avatar">
                          {(b.user_name || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="ab-user-name">{b.user_name || 'Unknown'}</div>
                          <div className="ab-user-email">{b.user_email || '—'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Station */}
                    <td>
                      <div className="ab-station-name">{b.station_name || `Station #${b.station_id}`}</div>
                      {b.station_city && (
                        <div className="ab-station-city">📍 {b.station_city}{b.station_state ? `, ${b.station_state}` : ''}</div>
                      )}
                    </td>

                    {/* Date */}
                    <td>
                      <span className="ab-date">{fmt(b.start_time)}</span>
                    </td>

                    {/* Time Slot */}
                    <td>
                      <div className="ab-time-slot">
                        <span>{fmtTime(b.start_time)}</span>
                        <span className="ab-time-sep">→</span>
                        <span>{fmtTime(b.end_time)}</span>
                      </div>
                    </td>

                    {/* Connector */}
                    <td>
                      <span className="ab-connector">
                        {b.connector_type_label
                          ? b.connector_type_label
                          : b.connector_id
                          ? `Port #${b.connector_id}`
                          : 'Virtual'}
                      </span>
                    </td>

                    {/* Energy / Price */}
                    <td>
                      <div className="ab-energy">
                        {b.energy_kwh != null ? <span>⚡ {b.energy_kwh} kWh</span> : null}
                        {b.total_price != null ? <span>₹ {Number(b.total_price).toFixed(2)}</span> : null}
                        {b.energy_kwh == null && b.total_price == null && '—'}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="ab-status-cell" style={{ minWidth: '140px', verticalAlign: 'middle' }}>
                      <BookingStatusBadge status={b.display_status || b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────────── */}
        {pagination.totalPages > 1 && (
          <div className="ab-pagination">
            <button
              className="ab-page-btn"
              disabled={pagination.page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <IconChevronLeft />
            </button>

            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(n =>
                n === 1 ||
                n === pagination.totalPages ||
                Math.abs(n - pagination.page) <= 2
              )
              .reduce((acc, n, idx, arr) => {
                if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…');
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) =>
                n === '…'
                  ? <span key={`e${i}`} className="ab-page-ellipsis">…</span>
                  : (
                    <button
                      key={n}
                      className={`ab-page-btn ${n === pagination.page ? 'ab-page-active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  )
              )}

            <button
              className="ab-page-btn"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              aria-label="Next page"
            >
              <IconChevronRight />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminBookings;
