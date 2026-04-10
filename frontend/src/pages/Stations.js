import React, { useState, useEffect } from 'react';
import './Stations.css';
import './Dashboard.css';
import { useAuth } from '../context/AuthContext';
import BookingModal from '../components/BookingModal';

const Stations = () => {
  const { isAuthenticated, getToken, user } = useAuth();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  
  // Connector Management State
  const [managingConnectorsStation, setManagingConnectorsStation] = useState(null);
  const [newConnector, setNewConnector] = useState({ type: 'CCS', power: 50, price_per_kwh: 15 });
  const [isAddingConnector, setIsAddingConnector] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [userAddress, setUserAddress] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [nearbyStations, setNearbyStations] = useState([]);
  const [searchRadius, setSearchRadius] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState({
    fastChargerOnly: false,
    availableOnly: false,
    nearby10Only: false
  });
  const [reviewState, setReviewState] = useState({}); // stationId -> { open, reviews, loading, rating, comment }
  const [selectedStationForBooking, setSelectedStationForBooking] = useState(null);
  const [hoveredRatingStation, setHoveredRatingStation] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const wsUrl = (() => {
    const apiBase = API_URL.replace(/\/api\/?$/, '');
    const isHttps = apiBase.startsWith('https://');
    const proto = isHttps ? 'wss://' : 'ws://';
    return apiBase.replace(/^https?:\/\//, proto);
  })();

  const normalizeLiveStatus = (station) => {
    if (station?.status) return station.status;
    // Backward compatibility with the older "availability" field.
    if (station?.availability === 'available') return 'available';
    return 'offline';
  };

  useEffect(() => {
    fetchAllStations();
    
    // Refresh stations every 30 seconds to get newly verified stations instead of 10s to lower API burden
    const interval = setInterval(() => {
      fetchAllStations();
    }, 30000);

    // Real-time status via WebSocket (simulated on backend)
    let ws = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg?.type !== 'station_status_update' || !Array.isArray(msg.stations)) return;

          // Only update stations that come from the DB (numeric IDs).
          setStations(prev =>
            prev.map(s => {
              const idNum = typeof s.id === 'number' ? s.id : (typeof s.id === 'string' && /^\d+$/.test(s.id) ? parseInt(s.id, 10) : null);
              if (idNum == null) return s;
              const upd = msg.stations.find(st => st.id === idNum);
              if (!upd) return s;
              return {
                ...s,
                status: upd.status,
                slots_total: upd.slots_total,
                slots_available: upd.slots_available,
                expected_wait_minutes: upd.expected_wait_minutes
              };
            })
          );
        } catch (e) {
          // Ignore malformed message
        }
      };
    } catch (e) {
      // If WS fails (e.g., server not running), we still keep polling refresh.
    }
    
    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllStations = async () => {
    try {
      const response = await fetch(`${API_URL}/stations`);
      const indiaResponse = await fetch(`${API_URL}/india-stations`);
      
      let allStations = [];

      if (response.ok) {
        const data = await response.json();
        const verified = (data.stations || []).map(s => ({...s, displaySource: 'Verified'}));
        allStations = [...allStations, ...verified];
      } else {
        setError('Failed to fetch verified stations');
      }

      const indiaData = await indiaResponse.json();
      if (indiaResponse.ok && indiaData.success) {
        const india = (indiaData.stations || []).map(s => ({...s, displaySource: 'India Network'}));
        allStations = [...allStations, ...india];
      }

      setStations(allStations);
      
      if (allStations.length === 0) {
        setInfo('No stations available yet. Stations need to be added by owners and verified by admins.');
      } else {
        setInfo('');
      }
    } catch (err) {
      console.error('Error fetching stations:', err);
      setError('Network error. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  // Get current location using browser geolocation
  const getCurrentLocation = () => {
    setLocationLoading(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setUserLocation({ lat, lng });
        setShowLocationSearch(true);

        // Reverse geocode to get address
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, { headers: { 'User-Agent': 'EV-Assistant-App/1.0 (contact@evassistant.com)' } });
          const data = await response.json();
          if (data.display_name) {
            setUserAddress(data.display_name);
          } else {
            setUserAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch (err) {
          console.error('Error getting address:', err);
          setUserAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }

        // Find nearby stations and calculate distances
        await findNearbyStations(lat, lng);
        setLocationLoading(false);
      },
      (err) => {
        setError('Unable to retrieve your location. Please enter address manually.');
        setLocationLoading(false);
        console.error('Geolocation error:', err);
      }
    );
  };

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return null;
    
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Find nearby stations and calculate distances for all stations
  const findNearbyStations = async (lat, lng, radius = searchRadius) => {
    try {
      setLocationLoading(true);
      
      // Calculate distances for all stations natively instead of fetching again to save bandwidth
      const allStationsWithDistance = stations.map(s => {
          const distance = calculateDistance(lat, lng, s.latitude, s.longitude);
          return { ...s, distance: distance ? Math.round(distance * 10) / 10 : null };
      });

      // Filter by radius and sort by distance
      const nearbyStations = allStationsWithDistance
        .filter(s => s.distance !== null && s.distance <= radius)
        .sort((a, b) => a.distance - b.distance);

      setNearbyStations(nearbyStations);
      setLocationLoading(false);
    } catch (err) {
      console.error('Error finding nearby stations:', err);
      setError('Error finding nearby stations');
      setLocationLoading(false);
    }
  };

  // Handle manual address search
  const handleAddressSearch = async () => {
    if (!userAddress.trim()) {
      setError('Please enter an address');
      return;
    }

    setLocationLoading(true);
    setError('');

    try {
      // Geocode address to get coordinates
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(userAddress)}&limit=1`, { headers: { 'User-Agent': 'EV-Assistant-App/1.0 (contact@evassistant.com)' } });
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setUserLocation({ lat, lng });
        setShowLocationSearch(true);
        setUserAddress(data[0].display_name || userAddress);
        await findNearbyStations(lat, lng);
      } else {
        setError('Address not found. Please try a different address.');
      }
    } catch (err) {
      console.error('Error geocoding address:', err);
      setError('Error finding address. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  // Clear location search
  const clearLocationSearch = () => {
    setShowLocationSearch(false);
    setUserLocation(null);
    setUserAddress('');
    setNearbyStations([]);
    // Refresh stations to remove distance calculations
    fetchAllStations();
  };

  // Get stations with distance calculation when location is set
  const getStationsWithDistance = (stationList) => {
    if (!userLocation) return stationList;
    
    return stationList.map(station => {
      const distance = calculateDistance(
        userLocation.lat, 
        userLocation.lng, 
        station.latitude, 
        station.longitude
      );
      return {
        ...station,
        distance: distance ? Math.round(distance * 10) / 10 : null
      };
    });
  };

  const filteredStations = showLocationSearch && nearbyStations.length > 0
    ? nearbyStations
    : (() => {
        // Add distance if location is set
        if (userLocation) {
          const withDistance = getStationsWithDistance(stations);
          return withDistance.sort((a, b) => {
            if (a.distance === null && b.distance === null) return 0;
            if (a.distance === null) return 1;
            if (b.distance === null) return -1;
            return a.distance - b.distance;
          });
        }
        return stations;
      })();

  const advancedFilteredStations = filteredStations.filter(station => {
    if (advancedFilters.fastChargerOnly && Number(station.power_kw || 0) < 50) return false;
    const status = station.status || station.availability || 'available';
    if (advancedFilters.availableOnly && status !== 'available') return false;
    if (advancedFilters.nearby10Only) {
      if (station.distance == null) return false;
      if (Number(station.distance) > 10) return false;
    }
    return true;
  });

  const toggleReviewPanel = async (stationId) => {
    const key = String(stationId);
    const current = reviewState[key] || { open: false, reviews: [], loading: false, rating: 5, comment: '' };
    const nextOpen = !current.open;
    setReviewState(prev => ({ ...prev, [key]: { ...current, open: nextOpen } }));
    if (!nextOpen || current.reviews.length > 0) return;

    setReviewState(prev => ({ ...prev, [key]: { ...current, open: true, loading: true } }));
    try {
      const res = await fetch(`${API_URL}/stations/${encodeURIComponent(stationId)}/reviews`);
      const data = await res.json();
      if (res.ok) {
        setReviewState(prev => ({
          ...prev,
          [key]: {
            ...(prev[key] || {}),
            open: true,
            loading: false,
            reviews: data.reviews || [],
            rating: 5,
            comment: ''
          }
        }));
      } else {
        setReviewState(prev => ({
          ...prev,
          [key]: { ...(prev[key] || {}), open: true, loading: false, reviews: [], error: data.error || 'Failed to load reviews' }
        }));
      }
    } catch (e) {
      setReviewState(prev => ({
        ...prev,
        [key]: { ...(prev[key] || {}), open: true, loading: false, reviews: [], error: 'Network error' }
      }));
    }
  };

  const fetchReviewsForHover = async (stationId) => {
    const key = String(stationId);
    if (reviewState[key]?.reviews?.length > 0 || reviewState[key]?.loading) return;

    setReviewState(prev => ({ ...prev, [key]: { ...(prev[key] || {open: false}), loading: true } }));
    try {
      const res = await fetch(`${API_URL}/stations/${encodeURIComponent(stationId)}/reviews`);
      const data = await res.json();
      if (res.ok) {
        setReviewState(prev => ({
          ...prev,
          [key]: {
            ...(prev[key] || {}),
            loading: false,
            reviews: data.reviews || []
          }
        }));
      } else {
        setReviewState(prev => ({ ...prev, [key]: { ...(prev[key] || {}), loading: false, reviews: [] } }));
      }
    } catch (e) {
      setReviewState(prev => ({ ...prev, [key]: { ...(prev[key] || {}), loading: false, reviews: [] } }));
    }
  };

  const submitReview = async (stationId) => {
    if (!isAuthenticated) {
      setError('Please login to submit a review.');
      return;
    }
    const key = String(stationId);
    const state = reviewState[key] || {};
    const token = getToken();
    try {
      const res = await fetch(`${API_URL}/stations/${encodeURIComponent(stationId)}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          rating: Number(state.rating || 5),
          comment: state.comment || ''
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.errors?.[0]?.msg || 'Failed to submit review');
        return;
      }
      // Refresh review list
      setReviewState(prev => ({
        ...prev,
        [key]: { ...(prev[key] || {}), reviews: [] }
      }));
      await toggleReviewPanel(stationId);
      await toggleReviewPanel(stationId); // reopen and fetch fresh
      fetchAllStations();
    } catch (e) {
      setError('Network error while submitting review');
    }
  };

  const handleManagePorts = async (station) => {
    try {
        const res = await fetch(`${API_URL}/stations/${station.id}`);
        if (res.ok) {
            const data = await res.json();
            setManagingConnectorsStation(data.station);
        } else {
            setManagingConnectorsStation(station); // Fallback
        }
    } catch (err) {
        setManagingConnectorsStation(station);
    }
  };

  const handleAddConnector = async (e) => {
    e.preventDefault();
    if (!managingConnectorsStation) return;
    setIsAddingConnector(true);
    try {
      const res = await fetch(`${API_URL}/connectors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          station_id: managingConnectorsStation.id,
          ...newConnector
        })
      });
      if (res.ok) {
        const data = await res.json();
        const updatedStation = { ...managingConnectorsStation, connectors: [...(managingConnectorsStation.connectors || []), { ...newConnector, id: data.id, status: 'available' }] };
        setManagingConnectorsStation(updatedStation);
        setStations(stations.map(s => s.id === updatedStation.id ? updatedStation : s));
        setNewConnector({ type: 'CCS', power: 50, price_per_kwh: 15 });
      }
    } catch (err) {
      console.error('Error adding connector:', err);
    } finally {
      setIsAddingConnector(false);
    }
  };

  const handleToggleConnectorStatus = async (connectorId, currentStatus) => {
    const newStatus = currentStatus === 'available' ? 'offline' : 'available';
    try {
      const res = await fetch(`${API_URL}/connectors/${connectorId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const updatedConnectors = managingConnectorsStation.connectors.map(c => 
          c.id === connectorId ? { ...c, status: newStatus } : c
        );
        const updatedStation = { ...managingConnectorsStation, connectors: updatedConnectors };
        setManagingConnectorsStation(updatedStation);
        setStations(stations.map(s => s.id === updatedStation.id ? updatedStation : s));
      }
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const handleDeleteConnector = async (connectorId) => {
    if (!window.confirm('Remove this connector?')) return;
    try {
      const res = await fetch(`${API_URL}/connectors/${connectorId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      if (res.ok) {
        const updatedConnectors = managingConnectorsStation.connectors.filter(c => c.id !== connectorId);
        const updatedStation = { ...managingConnectorsStation, connectors: updatedConnectors };
        setManagingConnectorsStation(updatedStation);
        setStations(stations.map(s => s.id === updatedStation.id ? updatedStation : s));
      }
    } catch (err) {
      console.error('Error deleting connector:', err);
    }
  };

  if (loading) {
    return (
      <div className="stations-page">
        <div className="loading">Loading stations...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        
        <header className="admin-page-header">
          <div>
            <h2>📍 Global Charging Stations</h2>
            <p>Browse our unified network of verified and public charging stations across India.</p>
          </div>
          <button onClick={() => { setLoading(true); fetchAllStations(); }} className="btn-header-refresh">
            🔄 Refresh List
          </button>
        </header>

        <div className="location-search-section">
          {!showLocationSearch ? (
            <div className="location-search-controls" style={{ marginTop: '1rem', justifyContent: 'center' }}>
              <div className="location-buttons" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={getCurrentLocation} className="btn-location" disabled={locationLoading}>
                  {locationLoading ? '📍 Getting Location...' : '📍 Use Current Location'}
                </button>
                <div className="or-divider">OR</div>
                <div className="address-input-group">
                  <input
                    type="text"
                    placeholder="Enter address (e.g., Connaught Place, Delhi)"
                    value={userAddress}
                    onChange={(e) => setUserAddress(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddressSearch()}
                    className="address-input"
                  />
                  <button onClick={handleAddressSearch} className="btn-search-address" disabled={locationLoading}>
                    Search
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="location-active-section" style={{ marginTop: '1rem' }}>
              <div className="location-info">
                <span className="location-icon">📍</span>
                <div className="location-details">
                  <strong>Searching near:</strong>
                  <span>{userAddress || `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`}</span>
                </div>
                <div className="radius-control">
                  <label>Search Radius: </label>
                  <select value={searchRadius} onChange={(e) => {
                    const newRadius = parseInt(e.target.value);
                    setSearchRadius(newRadius);
                    if (userLocation) {
                      findNearbyStations(userLocation.lat, userLocation.lng, newRadius);
                    }
                  }}>
                    <option value="10">10 km</option>
                    <option value="25">25 km</option>
                    <option value="50">50 km</option>
                    <option value="100">100 km</option>
                    <option value="500">500 km (Show All)</option>
                  </select>
                  <span style={{ marginLeft: '1rem', fontSize: '0.85rem', color: '#666' }}>
                    Stations are sorted by distance
                  </span>
                </div>
                <button onClick={clearLocationSearch} className="btn-clear-location">
                  Clear Location
                </button>
              </div>
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}
        {info && !error && <div className="info-message">{info}</div>}

        <div className="location-search-controls" style={{ marginBottom: '1.5rem', background: '#ffffff', borderRadius: '16px', padding: '1rem 1.5rem', border: '1px solid #e8eef8' }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={advancedFilters.fastChargerOnly} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, fastChargerOnly: e.target.checked }))} /> ⚡ Fast charger (≥50kW)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={advancedFilters.availableOnly} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, availableOnly: e.target.checked }))} /> 🟢 Available only
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem', opacity: userLocation ? 1 : 0.5 }}>
              <input type="checkbox" checked={advancedFilters.nearby10Only} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, nearby10Only: e.target.checked }))} disabled={!userLocation} /> 📏 Nearby (&lt;10km)
            </label>
          </div>
        </div>

        {locationLoading ? (
          <div className="loading">Finding nearby stations and calculating distances...</div>
        ) : advancedFilteredStations.length === 0 ? (
          <div className="no-stations">
            {showLocationSearch && nearbyStations.length === 0 ? (
              <div>
                <p>No stations found within {searchRadius} km of your location.</p>
                <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
                  Try increasing the search radius (up to 500 km) or check a different location.
                </p>
              </div>
            ) : userLocation && filteredStations.length > 0 ? (
              <div style={{ marginBottom: '1rem', padding: '1rem', background: '#e7f3ff', borderRadius: '8px', fontSize: '0.9rem' }}>
                💡 Stations are sorted by distance from your location. Distances shown on each station card.
              </div>
            ) : stations.length === 0 ? (
              <div>
                <p>No charging stations available right now.</p>
              </div>
            ) : (
              'No stations found matching your search.'
            )}
          </div>
        ) : (
          <div className="stations-grid">
            {advancedFilteredStations.map((station) => (
              <div key={`${station.id}-${Math.random()}`} className="station-card">
                <div className="station-header">
                  <h3>{station.name}</h3>
                  {(() => {
                    const liveStatus = normalizeLiveStatus(station);
                    const wait = typeof station.expected_wait_minutes === 'number' ? station.expected_wait_minutes : null;
                    return (
                      <span className={`status-badge ${liveStatus}`}>
                        {liveStatus === 'busy' && wait != null && wait > 0 ? `busy (~${wait}m)` : liveStatus}
                      </span>
                    );
                  })()}
                </div>
                <div className="station-details">
                  <p className="station-address">
                    📍 {station.address}, {station.city}, {station.state} {station.zip_code}
                  </p>
                  <div className="station-specs">
                    <div className="spec-item">
                      <span className="spec-label">🔌 Connector</span>
                      <span className="spec-value">{station.connector_type}</span>
                    </div>
                    <div className="spec-item">
                      <span className="spec-label">⚡ Power</span>
                      <span className="spec-value">{station.power_kw} kW</span>
                    </div>
                    {normalizeLiveStatus(station) === 'busy' && typeof station.expected_wait_minutes === 'number' && station.expected_wait_minutes > 0 && (
                      <div className="spec-item">
                        <span className="spec-label">⏳ Wait</span>
                        <span className="spec-value">~{station.expected_wait_minutes} min</span>
                      </div>
                    )}
                    {station.price_per_kw && (
                      <div className="spec-item">
                        <span className="spec-label">💰 Price</span>
                        <span className="spec-value">₹{station.price_per_kw}/kWh</span>
                      </div>
                    )}
                    {station.avg_rating ? (
                      <div 
                        className="spec-item rating-hover-wrapper" 
                        style={{ position: 'relative', cursor: 'help' }}
                        onMouseEnter={() => {
                          setHoveredRatingStation(station.id);
                          fetchReviewsForHover(station.id);
                        }}
                        onMouseLeave={() => setHoveredRatingStation(null)}
                      >
                        <span className="spec-label">⭐ Rating</span>
                        <span className="spec-value">
                          {station.avg_rating}/5 ({station.review_count || 0})
                        </span>
                        
                        {hoveredRatingStation === station.id && reviewState[String(station.id)]?.reviews?.length > 0 && (
                          <div style={{
                            position: 'absolute', bottom: '100%', left: '0', zIndex: 100, 
                            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', 
                            boxShadow: '0 10px 40px rgba(0,0,0,0.15)', padding: '1rem', width: '320px',
                            marginBottom: '0.75rem', pointerEvents: 'none'
                          }}>
                            <h5 style={{ margin: '0 0 0.75rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem', fontSize: '0.95rem' }}>Recent Reviews</h5>
                            {reviewState[String(station.id)].reviews.slice(0, 3).map(r => (
                              <div key={r.id} style={{ marginBottom: '0.6rem' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>{r.username}</span>
                                  <span style={{ color: '#eab308' }}>{'★'.repeat(r.rating)}</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem', lineHeight: '1.3' }}>{r.comment || 'No comment'}</div>
                              </div>
                            ))}
                            {reviewState[String(station.id)].reviews.length > 3 && (
                               <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.5rem' }}>
                                 And {reviewState[String(station.id)].reviews.length - 3} more...
                               </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                    {station.displaySource && (
                      <div className="spec-item">
                        <span className="spec-label">🔍 Source</span>
                        <span className="spec-value">{station.displaySource === 'India Network' ? '🇮🇳 India' : '🛡️ Verified'}</span>
                      </div>
                    )}
                  </div>
                  {userLocation && station.distance !== undefined && station.distance !== null && (
                    <div className="distance-badge">
                      📏 {station.distance} km away
                    </div>
                  )}
                  <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    {station.latitude && station.longitude && (
                      <>
                        <a
                          href={`https://www.google.com/maps?q=${station.latitude},${station.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="map-link"
                          title="View on Map"
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>🗺️ Map</span>
                        </a>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="map-link"
                          title="Get Directions"
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>🧭 Directions</span>
                        </a>
                      </>
                    )}
                    <button type="button" className="map-link" style={{ background: '#22c55e', color: 'white', border: 'none' }} onClick={() => setSelectedStationForBooking(station)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>⚡ Book Slot</span>
                    </button>
                    <button type="button" className="map-link" onClick={() => toggleReviewPanel(station.id)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>💬 Reviews</span>
                    </button>
                    {user?.id === station.owner_id && (
                      <button 
                        type="button" 
                        className="map-link" 
                        style={{ background: '#6366f1', color: 'white', border: 'none', gridColumn: '1 / -1' }} 
                        onClick={() => handleManagePorts(station)}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>🔌 Manage Ports</span>
                      </button>
                    )}
                  </div>

                  {reviewState[String(station.id)]?.open && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: 8 }}>
                      {reviewState[String(station.id)]?.loading ? (
                        <p style={{ margin: 0 }}>Loading reviews...</p>
                      ) : (
                        <>
                          <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: '0.5rem' }}>
                            {(reviewState[String(station.id)]?.reviews || []).length === 0 ? (
                              <p style={{ margin: 0 }}>No reviews yet.</p>
                            ) : (
                              (reviewState[String(station.id)]?.reviews || []).map((r) => (
                                <div key={r.id} style={{ marginBottom: '0.4rem', borderBottom: '1px solid #eee', paddingBottom: '0.4rem' }}>
                                  <strong>{r.username}</strong> - {'⭐'.repeat(Number(r.rating || 0))}
                                  <div style={{ fontSize: '0.9rem' }}>{r.comment}</div>
                                </div>
                              ))
                            )}
                          </div>
                          {isAuthenticated && user?.id !== station.owner_id && (
                            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
                              <div style={{ display: 'flex', gap: '0.15rem', alignItems: 'center' }}>
                                {[1, 2, 3, 4, 5].map(star => (
                                  <span
                                    key={star}
                                    style={{ 
                                      cursor: 'pointer', 
                                      fontSize: '1.5rem', 
                                      lineHeight: '1', 
                                      color: star <= (reviewState[String(station.id)]?.rating || 5) ? '#eab308' : '#cbd5e1',
                                      transition: 'color 0.2s',
                                      userSelect: 'none'
                                    }}
                                    onClick={() => setReviewState(prev => ({ 
                                      ...prev, 
                                      [String(station.id)]: { ...(prev[String(station.id)] || {}), rating: star } 
                                    }))}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                              <input
                                type="text"
                                placeholder="Write a review..."
                                value={reviewState[String(station.id)]?.comment || ''}
                                onChange={(e) => setReviewState(prev => ({ ...prev, [String(station.id)]: { ...(prev[String(station.id)] || {}), comment: e.target.value } }))}
                                style={{ flex: 1, minWidth: 150, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                              />
                              <button type="button" className="btn-search-address" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => submitReview(station.id)}>Submit</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!locationLoading && (
          <div className="stations-count">
            {showLocationSearch && nearbyStations.length > 0 ? (
              `Found ${advancedFilteredStations.length} station(s) within ${searchRadius} km of your location`
            ) : userLocation ? (
              `Showing ${advancedFilteredStations.length} stations sorted by distance from your location`
            ) : (
              `Showing all ${advancedFilteredStations.length} charging stations`
            )}
          </div>
        )}
        
        {selectedStationForBooking && (
          <BookingModal 
            station={selectedStationForBooking} 
            onClose={() => setSelectedStationForBooking(null)}
            getToken={getToken}
            isAuthenticated={isAuthenticated}
          />
        )}

        {managingConnectorsStation && (
          <div className="booking-modal-overlay">
            <div className="booking-modal-content glass-modal connector-mgmt-modal">
              <button className="booking-modal-close" onClick={() => setManagingConnectorsStation(null)}>&times;</button>
              
              <div className="booking-modal-header">
                <h3>🔌 Manage Connectors</h3>
                <p className="station-name-highlight">{managingConnectorsStation.name}</p>
              </div>

              <div className="connector-list">
                <h4>Existing Ports</h4>
                {(!managingConnectorsStation.connectors || managingConnectorsStation.connectors.length === 0) ? (
                  <p className="no-data">No connectors added yet.</p>
                ) : (
                  <div className="connector-items">
                    {managingConnectorsStation.connectors.map(c => (
                      <div key={c.id} className={`connector-item-row ${c.status}`}>
                        <div className="conn-info">
                          <span className="conn-type">{c.type}</span>
                          <span className="conn-power">{c.power}kW</span>
                        </div>
                        <div className="conn-price">₹{c.price_per_kwh}/kWh</div>
                        <div className="conn-actions">
                          <button 
                            className={`btn-status ${c.status}`} 
                            onClick={() => handleToggleConnectorStatus(c.id, c.status)}
                          >
                            {c.status === 'available' ? '🟢 Online' : '🔴 Offline'}
                          </button>
                          <button className="btn-delete" onClick={() => handleDeleteConnector(c.id)}>🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form className="add-connector-form" onSubmit={handleAddConnector}>
                <h4>Add New Connector</h4>
                <div className="form-grid-mini">
                  <div className="form-group">
                    <label>Type</label>
                    <select value={newConnector.type} onChange={(e) => setNewConnector({...newConnector, type: e.target.value})}>
                      <option value="CCS">CCS</option>
                      <option value="Type2">Type 2</option>
                      <option value="CHAdeMO">CHAdeMO</option>
                      <option value="GB/T">GB/T</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Power (kW)</label>
                    <input type="number" value={newConnector.power} onChange={(e) => setNewConnector({...newConnector, power: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Price/kWh</label>
                    <input type="number" step="0.1" value={newConnector.price_per_kwh} onChange={(e) => setNewConnector({...newConnector, price_per_kwh: e.target.value})} />
                  </div>
                </div>
                <button type="submit" className="booking-submit-btn" disabled={isAddingConnector}>
                  {isAddingConnector ? 'Adding...' : 'Add Connector'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Stations;
