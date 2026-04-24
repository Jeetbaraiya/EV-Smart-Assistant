import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './BookingModal.css';

const BookingModal = ({ station, onClose, onBookingSuccess, getToken, isAuthenticated }) => {
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [connectors, setConnectors] = useState([]);
  const [selectedConnector, setSelectedConnector] = useState(null);
  const [fetchingConnectors, setFetchingConnectors] = useState(false);
  const [bookedSlots, setBookedSlots] = useState([]);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const fetchBookedSlots = async (date) => {
    try {
      const res = await fetch(`${API_URL}/bookings/station/${station.id}/booked-slots?date=${date}`);
      const data = await res.json();
      if (res.ok) {
        setBookedSlots(data.bookedSlots || []);
      }
    } catch (err) {
      console.error('Error fetching booked slots:', err);
    }
  };

  // Scroll lock when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const istDate = getIstDateStr();
    setBookingDate(istDate);
    setBookingTime('');
    fetchConnectors();
    fetchBookedSlots(istDate);
  }, [station.id]);

  useEffect(() => {
    if (bookingDate) {
      fetchBookedSlots(bookingDate);
    }
  }, [bookingDate]);

  const getIstDateStr = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().split('T')[0];
  };

  const generateSlots = () => {
    const slots = [];
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    
    const currHour = istTime.getUTCHours();
    const currDate = istTime.toISOString().split('T')[0];
    const isToday = bookingDate === currDate;

    for (let i = 0; i < 24; i++) {
        // Skip hours that have passed if booking today
        const isPast = isToday && i <= currHour;
        
        // Check if already booked
        const isOccupied = (() => {
          // Find all bookings for this specific hour
          const bookingsForHour = bookedSlots.filter(b => {
            const bStart = new Date(b.start_time);
            const bIst = new Date(bStart.getTime() + istOffset);
            const bHour = bIst.getUTCHours();
            const bDate = bIst.toISOString().split('T')[0];
            return bDate === bookingDate && bHour === i;
          });

          if (bookingsForHour.length === 0) return false;

          // Case 1: Specific connector selected
          if (selectedConnector) {
            return bookingsForHour.some(b => {
              // Real connector: Match by ID
              if (!selectedConnector.is_virtual && b.connector_id) {
                return String(b.connector_id) === String(selectedConnector.id);
              }
              // Virtual/Synth connector: Match by label
              if (selectedConnector.is_virtual && !b.connector_id) {
                return b.connector_type_label === selectedConnector.type;
              }
              return false;
            });
          }

          // Case 2: No connector selected yet
          // Only show as occupied if ALL connectors of this station are taken for this hour
          return bookingsForHour.length >= (connectors.length || 1);
        })();

        if (isPast) continue;
        
        const start = String(i).padStart(2, '0') + ':00';
        const endHour = i + 1;
        const endStr = endHour === 24 ? '23:59' : String(endHour).padStart(2, '0') + ':00';
        
        const ampm = (h) => {
            const hour = h % 12 || 12;
            const period = h >= 12 && h < 24 ? 'PM' : (h >= 24 ? 'PM' : 'AM');
            return `${hour}:00 ${period}`;
        };
        const endAmPm = (h) => {
            if (h === 24) return '11:59 PM';
            const hour = h % 12 || 12;
            const period = h >= 12 ? 'PM' : 'AM';
            return `${hour}:00 ${period}`;
        };
        
        slots.push({
            start: start,
            label: `${ampm(i)} - ${endAmPm(endHour)}`,
            isOccupied: isOccupied
        });
    }
    return slots;
  };

  const fetchConnectors = async () => {
    setFetchingConnectors(true);
    try {
      const res = await fetch(`${API_URL}/connectors/station/${station.id}`);
      const data = await res.json();
      
      let stationConnectors = [];
      if (res.ok && data.connectors && data.connectors.length > 0) {
        stationConnectors = data.connectors;
      } else {
        // Synthesize connectors from station data
        // Handle multiple types separated by commas, slashes, or "and"
        let rawTypes = station.connector_type || (station.power_kw > 50 ? 'DC Fast Charger' : 'AC Standard');
        
        // Split by common separators: comma, slash, or the word " and "
        const types = rawTypes
          .split(/,|\/|\s+and\s+/)
          .map(t => t.trim())
          .filter(t => t.length > 0);
          
        stationConnectors = types.map((t, idx) => ({
          id: `synth-${station.id}-${idx}`,
          type: t,
          power: station.power_kw || (t.toLowerCase().includes('dc') || t.toLowerCase().includes('ccs') || t.toLowerCase().includes('fast') ? 50 : 22),
          price_per_kwh: station.price_per_kw || station.price_per_kwh || 15,
          status: 'available',
          is_virtual: true
        }));
      }

      setConnectors(stationConnectors);
      setSelectedConnector(null);
    } catch (err) {
      console.error('Error fetching connectors:', err);
    } finally {
      setFetchingConnectors(false);
    }
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
        setError('Please sign in to book a charging session.');
        return;
    }

    if (!selectedConnector) {
        setError('Please select a connector.');
        return;
    }

    if (!bookingTime) {
        setError('Please select a valid time slot from the grid.');
        return;
    }
    
    setLoading(true);
    setError('');

    // duration is always rigidly fixed to 1 hour (60 minutes) for block slots
    const fixedDuration = 60;

    // Safely enforce that the chosen date and time represent an exact Indian Standard Time (+05:30) slot regardless of browser default
    const startTime = new Date(`${bookingDate}T${bookingTime}:00+05:30`);
    
    // Validate that the slot is not in the past
    if (startTime < new Date()) {
        setError('You cannot book a time slot in the past.');
        setLoading(false);
        return;
    }

    const price = selectedConnector.price_per_kwh 
        ? (selectedConnector.power * (fixedDuration / 60) * selectedConnector.price_per_kwh).toFixed(2) 
        : 0;

    try {
      const res = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          station_id: station.id,
          connector_id: selectedConnector.is_virtual ? null : selectedConnector.id,
          virtual_connector: selectedConnector.is_virtual ? selectedConnector : null,
          start_time: startTime.toISOString(),
          duration_minutes: fixedDuration,
          energy_kwh: (selectedConnector.power * (fixedDuration / 60) * 0.9).toFixed(2),
          total_price: price
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        if (onBookingSuccess) onBookingSuccess(data.booking);
        setTimeout(() => onClose(), 2000);
      } else {
        const errorMsg = data.details ? `Booking failed: ${data.details}` : (data.error || 'Failed to create booking');
        setError(errorMsg);
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const estimatedPrice = selectedConnector?.price_per_kwh 
    ? (selectedConnector.power * (60 / 60) * selectedConnector.price_per_kwh).toFixed(2)
    : 'Select Connector';

  const stationStatus = station?.status || station?.availability || 'available';
  const statusColor = stationStatus === 'available' ? '#22c55e' : stationStatus === 'busy' ? '#f59e0b' : '#ef4444';

  const modalContent = (
    <div className="booking-modal-overlay">
      <div className="booking-modal-content">
        <button className="booking-modal-close" onClick={onClose} aria-label="Close modal">&times;</button>
        
        {!station ? (
          <div className="booking-error-msg">Error: Station data missing</div>
        ) : success ? (
          <div className="booking-success-message">
            <div className="success-icon">✅</div>
            <h3>Booking Confirmed!</h3>
            <p>Your slot at <strong>{station.name || 'Station'}</strong> has been reserved.</p>
            
            <div className="booking-card confirmed-summary" style={{ textAlign: 'left', margin: '1.5rem 0', boxShadow: 'none', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
               <div className="booking-details-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1rem' }}>
                  <div className="detail-item">
                    <span className="detail-label">START</span>
                    <span className="detail-value" style={{ fontSize: '0.85rem' }}>
                      {(() => {
                        const d = new Date(`${bookingDate}T${bookingTime}:00+05:30`);
                        return new Intl.DateTimeFormat('en-IN', { 
                          weekday: 'short', day: 'numeric', month: 'short', 
                          hour: '2-digit', minute: '2-digit', hour12: true,
                          timeZone: 'Asia/Kolkata' 
                        }).format(d);
                      })()}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">END</span>
                    <span className="detail-value" style={{ fontSize: '0.85rem' }}>
                      {(() => {
                        const [h, m] = bookingTime.split(':').map(Number);
                        const endH = h + 1;
                        const endM = endH === 24 ? 59 : 0;
                        const d = new Date(`${bookingDate}T${String(endH === 24 ? 23 : endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00+05:30`);
                        return new Intl.DateTimeFormat('en-IN', { 
                          weekday: 'short', day: 'numeric', month: 'short', 
                          hour: '2-digit', minute: '2-digit', hour12: true,
                          timeZone: 'Asia/Kolkata' 
                        }).format(d);
                      })()}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">DURATION</span>
                    <span className="detail-value">⏱ 1h</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">CONNECTOR</span>
                    <span className="detail-value">🔌 {selectedConnector?.type}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">ENERGY</span>
                    <span className="detail-value">⚡ {(selectedConnector?.power * (60 / 60) * 0.9).toFixed(1)} kWh</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">EST. COST</span>
                    <span className="detail-value highlight">₹{estimatedPrice}</span>
                  </div>
               </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              📍 {station.address}{station.city ? `, ${station.city}` : ''}
            </p>
            <p className="success-redirect">Redirecting back...</p>
          </div>
        ) : (
          <>
            {/* ── Station Identity Banner ── */}
            <div className="booking-station-banner">
              <div className="booking-station-banner-left">
                <div className="booking-station-icon">⚡</div>
                <div className="booking-station-info">
                  <h3 className="booking-station-title">{station.name || 'Charging Station'}</h3>
                  <p className="booking-station-addr">
                    📍 {station.address || ''}{station.city ? `, ${station.city}` : ''}{station.state ? `, ${station.state}` : ''}
                  </p>
                  <div className="booking-station-meta">
                    {station.connector_type && (
                      <span className="booking-meta-tag">🔌 {station.connector_type}</span>
                    )}
                    {station.power_kw && (
                      <span className="booking-meta-tag">⚡ {station.power_kw} kW</span>
                    )}
                    <span className="booking-meta-status" style={{ color: statusColor, borderColor: statusColor }}>
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: statusColor, verticalAlign: 'middle', marginRight: 4 }} />
                      {stationStatus.charAt(0).toUpperCase() + stationStatus.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="booking-modal-header" style={{ paddingTop: '0.75rem' }}>
              <div className="header-title-row">
                <h3>🗓️ 1. Schedule Appointment</h3>
              </div>
            </div>

            <form onSubmit={handleBooking} className="booking-form">
              <div className="booking-form-grid">
                <div className="form-group full-width">
                  <label>Select Connector</label>
                  {fetchingConnectors ? (
                    <div className="connector-loader">Finding available ports...</div>
                  ) : (
                    <select 
                      className="connector-select"
                      value={selectedConnector?.id || ''} 
                      onChange={(e) => {
                        const val = e.target.value;
                        const found = connectors.find(c => String(c.id) === val);
                        setSelectedConnector(found);
                      }}
                      required
                    >
                      <option value="" disabled>Choose a charging port</option>
                      {(connectors || []).map(c => (
                        <option key={c.id || Math.random()} value={c.id} disabled={c.status === 'offline'}>
                          {c.type} ({c.power}kW) - {c.status} {c.price_per_kwh ? `(₹${c.price_per_kwh}/kWh)` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {(!connectors || connectors.length === 0) && !fetchingConnectors && (
                    <div className="no-connectors-alert text-sm text-red-500 mt-1">
                      ⚠️ No connectors configured for this station.
                    </div>
                  )}
                </div>
                
                <div className="form-group full-width">
                  <label>Preferred Date</label>
                  <input 
                    type="date" 
                    value={bookingDate} 
                    onChange={(e) => {
                      setBookingDate(e.target.value);
                      setBookingTime(''); // Reset selected time slot on date change
                    }}
                    min={getIstDateStr()}
                    required 
                    style={{ padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', cursor: 'pointer' }}
                  />
                </div>
                
                <div className="form-group full-width">
                  <label>Available Time Slots</label>
                  <div className="time-slots-container">
                    {generateSlots().map((slot, index) => (
                      <button
                        type="button"
                        key={index}
                        className={`time-slot-btn ${bookingTime === slot.start ? 'selected' : ''} ${slot.isOccupied ? 'occupied' : ''}`}
                        onClick={() => {
                          if (slot.isOccupied) {
                            setError('This slot is already booked. Please choose another one.');
                            setBookingTime('');
                          } else {
                            setError('');
                            setBookingTime(slot.start);
                          }
                        }}
                      >
                        {slot.label}
                        {slot.isOccupied && <div className="slot-occupied-tag">Booked</div>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {selectedConnector && (
                <div className="booking-summary-box">
                    <div className="summary-item">
                        <span className="summary-label">Connector Type</span>
                        <span className="summary-value">{selectedConnector.type}</span>
                    </div>
                    <div className="summary-item">
                        <span className="summary-label">Power Rate</span>
                        <span className="summary-value">{selectedConnector.power} kW</span>
                    </div>
                    {bookingTime && (
                      <>
                        <div className="summary-item">
                          <span className="summary-label">Scheduled Date</span>
                          <span className="summary-value">📅 {new Date(bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">Start Time</span>
                          <span className="summary-value">
                            ⏰ {(() => {
                                const [h, m] = bookingTime.split(':').map(Number);
                                const period = h >= 12 ? 'PM' : 'AM';
                                const h12 = h % 12 || 12;
                                return `${h12}:${String(m).padStart(2, '0')} ${period}`;
                            })()}
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">End Time</span>
                          <span className="summary-value">
                              🏁 {(() => {
                                  const [h, m] = bookingTime.split(':').map(Number);
                                  const endH = h + 1;
                                  const period = endH >= 12 && endH < 24 ? 'PM' : (endH >= 24 ? 'PM' : 'AM');
                                  const h12 = endH % 12 || 12;
                                  const endM = endH === 24 ? '59' : '00';
                                  const displayH = endH === 24 ? 11 : h12;
                                  return `${displayH}:${endM} ${period}`;
                              })()}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="summary-divider"></div>
                    <div className="summary-item highlight">
                        <span className="summary-label">Est. Total Price</span>
                        <span className="summary-value price-tag">
                          ₹{estimatedPrice}
                        </span>
                    </div>
                </div>
              )}

              {error && <div className="booking-error-msg">⚠️ {error}</div>}

              <div className="booking-actions">
                <button type="submit" className="booking-submit-btn" disabled={loading}>
                  {loading ? 'Confirming...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default BookingModal;
