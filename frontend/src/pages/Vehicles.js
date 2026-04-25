import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Vehicles.css';

const getBatteryStatus = (pct) => {
  if (pct >= 60) return { label: 'GOOD', color: '#22C55E' };
  if (pct >= 30) return { label: 'LOW', color: '#F59E0B' };
  return { label: 'CRITICAL', color: '#EF4444' };
};

const Vehicles = () => {
  const { getToken } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  const [form, setForm] = useState({ name: '', battery: 40, efficiency: 15, connector_types: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [batteryPct, setBatteryPct] = useState(55);
  const [formError, setFormError] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const connectorOptions = [
    'CCS2',
    'Type 2',
    'CHAdeMO',
    'Bharat DC-001',
    'Bharat AC-001',
    'GB/T',
    '15A/16A Socket',
    'Other'
  ];
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/vehicles`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Normalize backend battery_capacity field to frontend battery field
        const normalized = data.map(v => ({
          ...v,
          battery: v.battery || v.battery_capacity
        }));
        setVehicles(normalized);
        if (normalized.length > 0) setSelectedId(normalized[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let newForm = { ...form, [name]: value };

    // Smart Suggestions Logic
    if (name === 'name') {
      const lowerName = value.toLowerCase();
      const commonEVs = ['nexon', 'mg zs', 'tiago', 'tigor', 'kona', 'ioniq', 'ev6', 'atto', 'e6', 'punch', 'xuv400'];
      
      if (commonEVs.some(ev => lowerName.includes(ev))) {
        // Auto-suggest CCS2 and Type 2 for these common Indian EVs
        const suggestions = ['CCS2', 'Type 2'];
        const current = newForm.connector_types || [];
        const merged = [...new Set([...current, ...suggestions])];
        newForm.connector_types = merged;
      }
    }
    setForm(newForm);
  };

  const handleConnectorToggle = (type) => {
    const current = form.connector_types || [];
    if (current.includes(type)) {
      setForm({ ...form, connector_types: current.filter(t => t !== type) });
    } else {
      setForm({ ...form, connector_types: [...current, type] });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Vehicle name is required'); return; }
    if (form.battery <= 0 || form.battery > 200) { setFormError('Battery must be between 1–200 kWh'); return; }
    if (form.efficiency <= 0) { setFormError('Efficiency must be > 0'); return; }
    if (!form.connector_types || form.connector_types.length === 0) { setFormError('Select at least one connector type'); return; }

    setFetching(true);
    try {
      const isEditing = editingId !== null;
      const url = isEditing ? `${API_URL}/vehicles/${editingId}` : `${API_URL}/vehicles`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          name: form.name.trim(),
          battery_capacity: parseFloat(form.battery),
          efficiency: parseFloat(form.efficiency),
          connector_types: form.connector_types
        })
      });

      if (res.ok) {
        const result = await res.json();
        const normalized = {
          ...result,
          battery: result.battery_capacity
        };
        
        if (isEditing) {
          setVehicles(vehicles.map(v => v.id === editingId ? normalized : v));
          setEditingId(null);
        } else {
          setVehicles([normalized, ...vehicles]);
          setSelectedId(normalized.id);
        }
        setForm({ name: '', battery: 40, efficiency: 15, connector_types: [] });
      } else {
        const errorData = await res.json();
        setFormError(errorData.error || 'Failed to save vehicle');
      }
    } catch (err) {
      setFormError('Network error while saving');
    } finally {
      setFetching(false);
    }
  };

  const handleEdit = (vehicle) => {
    setEditingId(vehicle.id);
    setForm({
      name: vehicle.name,
      battery: vehicle.battery || vehicle.battery_capacity,
      efficiency: vehicle.efficiency,
      connector_types: vehicle.connector_types || []
    });
    setFormError('');
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', battery: 40, efficiency: 15 });
    setFormError('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this vehicle?')) return;
    try {
      const res = await fetch(`${API_URL}/vehicles/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const updated = vehicles.filter(v => v.id !== id);
        setVehicles(updated);
        if (selectedId === id) setSelectedId(updated.length ? updated[0].id : null);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const selectedVehicle = vehicles.find(v => v.id === Number(selectedId));
  const batteryVal = selectedVehicle ? (selectedVehicle.battery || selectedVehicle.battery_capacity || 0) : 0;
  const effVal = selectedVehicle ? (selectedVehicle.efficiency || 15) : 15;
  const currentBatteryPct = parseFloat(batteryPct) || 0;

  const remainingEnergy = selectedVehicle ? (batteryVal * currentBatteryPct / 100).toFixed(1) : 0;
  const estimatedRange = (selectedVehicle && effVal > 0) ? ((remainingEnergy / effVal) * 100).toFixed(1) : 0;
  const status = getBatteryStatus(currentBatteryPct);

  return (
    <div className="vehicles-page">
      <div className="vehicles-container">

        {/* ── Header ──────────────────────────────── */}
        <div className="vehicles-header">
          <div className="vehicles-header-icon">🚗</div>
          <h1 className="vehicles-title">Fleet Management</h1>
          <p className="vehicles-subtitle">Manage your EV specifications and get real-time range analytics.</p>
        </div>

        <div className="vehicles-grid">

          {/* ── Add/Edit Vehicle ──────────────────────── */}
          <div className={`v-card ${dropdownOpen ? 'v-card-top' : ''}`}>
            <h3 className="v-card-title">{editingId ? '📝 Edit Vehicle Spec' : '➕ Register New Vehicle'}</h3>
            {formError && <div className="v-error">⚠️ {formError}</div>}
            <form onSubmit={handleSave}>
              <div className="v-form-group">
                <label>Vehicle Model Name</label>
                <input type="text" name="name" value={form.name} onChange={handleFormChange}
                  placeholder="e.g. Nexon EV Max" className="v-input" />
              </div>
              <div className="v-form-row">
                <div className="v-form-group">
                  <label>Battery (kWh)</label>
                  <input type="number" name="battery" value={form.battery} onChange={handleFormChange}
                    min="1" max="200" step="0.1" className="v-input" />
                </div>
                <div className="v-form-group">
                  <label>Efficiency (kWh/100km)</label>
                  <input type="number" name="efficiency" value={form.efficiency} onChange={handleFormChange}
                    min="1" max="100" step="0.1" className="v-input" />
                </div>
              </div>

              <div className="v-form-group" style={{ marginTop: '1.25rem' }}>
                <label>Supported Connector Types ⚡</label>
                <div className={`v-multi-select ${dropdownOpen ? 'open' : ''}`}>
                  <div className="v-select-trigger" onClick={() => setDropdownOpen(!dropdownOpen)}>
                    <span className="v-select-label">
                      {(form.connector_types || []).length > 0 
                        ? `${(form.connector_types || []).length} Selected`
                        : 'Select Connectors...'}
                    </span>
                    <span className="v-select-arrow">{dropdownOpen ? '▲' : '▼'}</span>
                  </div>
                  
                  {dropdownOpen && (
                    <div className="v-dropdown-menu">
                      {connectorOptions.map(type => (
                        <label key={type} className="v-dropdown-item">
                          <input 
                            type="checkbox" 
                            checked={(form.connector_types || []).includes(type)} 
                            onChange={() => handleConnectorToggle(type)}
                          />
                          <span className="v-item-text">{type}</span>
                          {(form.connector_types || []).includes(type) && <span className="v-item-check">✓</span>}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Visual Chips for selected items */}
                <div className="v-selected-chips">
                  {(form.connector_types || []).map(type => (
                    <span key={type} className="v-mini-chip">
                      {type}
                      <button type="button" onClick={() => handleConnectorToggle(type)}>✕</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="v-form-submit-row">
                <button type="submit" className="v-save-btn" disabled={fetching}>
                  {fetching ? '⏳ Saving...' : (editingId ? 'Update Vehicle' : 'Save to Fleet')}
                </button>
                {editingId && (
                  <button type="button" className="v-cancel-btn" onClick={cancelEdit}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* ── Range Analytics ───────────────────── */}
          <div className="v-card">
            <h3 className="v-card-title">📉 Real-time Range Analytics</h3>
            <div className="v-form-row">
              <div className="v-form-group">
                <label>Active Vehicle</label>
                <select className="v-input" value={selectedId || ''}
                  onChange={(e) => setSelectedId(Number(e.target.value))}>
                  <option value="" disabled>Select a vehicle</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="v-form-group">
                <label>Current SoC (%)</label>
                <input type="number" value={batteryPct}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') { setBatteryPct(''); return; }
                    setBatteryPct(Math.min(100, Math.max(0, parseInt(val, 10))));
                  }}
                  min="0" max="100" className="v-input" />
              </div>
            </div>

            {selectedVehicle ? (
              <>
                <div className="v-estimate-grid">
                  <div className="v-estimate-item">
                    <span className="v-estimate-label">Energy</span>
                    <span className="v-estimate-value">{remainingEnergy} <small style={{ fontSize: '0.7rem', opacity: 0.6 }}>kWh</small></span>
                  </div>
                  <div className="v-estimate-item" style={{ borderColor: status.color + '44' }}>
                    <span className="v-estimate-label">Est. Range</span>
                    <span className="v-estimate-value" style={{ color: status.color }}>{estimatedRange} <small style={{ fontSize: '0.7rem', opacity: 0.6 }}>km</small></span>
                  </div>
                  <div className="v-estimate-item">
                    <span className="v-estimate-label">Health</span>
                    <span className="v-estimate-value" style={{ color: status.color, fontSize: '1rem' }}>{status.label}</span>
                  </div>
                </div>

                <div className="v-form-group" style={{ marginBottom: 0 }}>
                  <label>Battery State of Charge</label>
                  <div className="v-battery-bar-wrap">
                    <div className="v-battery-bar" style={{ width: `${batteryPct}%`, background: status.color }} />
                  </div>
                </div>
              </>
            ) : (
              <div className="v-empty" style={{ padding: '2rem 0' }}>Select a vehicle from your fleet to view live range estimates.</div>
            )}
          </div>
        </div>

        {/* ── Vehicle List ─────────────────────────── */}
        <div className="v-card v-card-list">
          <h3 className="v-card-title">🚗 My Vehicles </h3>
          {loading ? (
            <div className="v-empty">📡 Synchronizing fleet data...</div>
          ) : vehicles.length === 0 ? (
            <div className="v-empty">Your Fleet is currently empty. Register your first EV to begin tracking.</div>
          ) : (
            <div className="v-table-container">
              <table className="v-table">
                <thead>
                  <tr>
                    <th>Vehicle Model</th>
                    <th>Capacity (kWh)</th>
                    <th>Efficiency (kWh/100km)</th>
                    <th>Connectors</th>
                    <th style={{ textAlign: 'center' }}>Management</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map(v => (
                    <tr key={v.id} className={selectedId === v.id ? 'v-row-active' : ''}
                      onClick={() => setSelectedId(v.id)}>
                      <td>{v.name}</td>
                      <td>{v.battery || v.battery_capacity}</td>
                      <td>{v.efficiency}</td>
                      <td>
                        <div className="v-table-connectors">
                          {v.connector_types && v.connector_types.map(c => (
                            <span key={c} className="v-mini-badge">{c}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="v-edit-btn"
                          onClick={(e) => { e.stopPropagation(); handleEdit(v); }}
                          title="Edit vehicle specs">✏️</button>
                        <button className="v-delete-btn"
                          onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
                          title="Decommission vehicle">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Vehicles;
