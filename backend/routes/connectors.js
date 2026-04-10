const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// Get all connectors for a station
router.get('/station/:stationId', (req, res) => {
  const { stationId } = req.params;
  const dbInstance = db.getDb();

  dbInstance.all(
    'SELECT * FROM connectors WHERE station_id = ? ORDER BY type ASC',
    [stationId],
    (err, connectors) => {
      if (err) return res.status(500).json({ error: 'Database error', details: err.message });
      res.json({ connectors });
    }
  );
});

// Add a connector (Owner of station only)
router.post('/', authenticate, async (req, res) => {
  const { station_id, type, power, price_per_kwh } = req.body;
  const userId = req.user.id;
  const dbInstance = db.getDb();

  try {
    // Verify ownership
    const station = await new Promise((resolve, reject) => {
      dbInstance.get('SELECT owner_id FROM charging_stations WHERE id = ?', [station_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!station) return res.status(404).json({ error: 'Station not found' });
    if (station.owner_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to manage this station' });
    }

    dbInstance.run(
      'INSERT INTO connectors (station_id, type, power, price_per_kwh, status) VALUES (?, ?, ?, ?, ?)',
      [station_id, type, power, price_per_kwh, 'available'],
      function(err) {
        if (err) return res.status(500).json({ error: 'Failed to add connector' });
        res.status(201).json({ message: 'Connector added', id: this.lastID });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update connector status (Owner/Staff)
router.put('/:id/status', authenticate, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // available, busy, offline
  const dbInstance = db.getDb();

  dbInstance.run(
    'UPDATE connectors SET status = ? WHERE id = ?',
    [status, id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Update failed' });
      res.json({ message: 'Status updated' });
    }
  );
});

// Delete a connector
router.delete('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const dbInstance = db.getDb();
    
    dbInstance.run('DELETE FROM connectors WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).json({ error: 'Delete failed' });
        res.json({ message: 'Connector removed' });
    });
});

module.exports = router;
