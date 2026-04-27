const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Get connectors for a station
router.get('/station/:id', async (req, res) => {
  try {
    const stationId = req.params.id;
    const dbInstance = db.getDb();
    
    dbInstance.all(
      'SELECT * FROM connectors WHERE station_id = ?',
      [stationId],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ connectors: rows || [] });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a new connector (requires authentication, ideally owner/admin)
router.post('/', authenticate, async (req, res) => {
  try {
    const { station_id, type, power, price_per_kwh } = req.body;
    
    if (!station_id || !type || !power || price_per_kwh === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const dbInstance = db.getDb();
    
    // Check if the user owns this station or is an admin
    dbInstance.get(
      'SELECT owner_id FROM charging_stations WHERE id = ?',
      [station_id],
      (err, station) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!station) return res.status(404).json({ error: 'Station not found' });
        
        if (station.owner_id !== req.user.userId && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Unauthorized to add connectors to this station' });
        }
        
        dbInstance.run(
          `INSERT INTO connectors (station_id, type, power, price_per_kwh) 
           VALUES (?, ?, ?, ?)`,
          [station_id, type, power, price_per_kwh],
          function(err) {
            if (err) return res.status(500).json({ error: 'Failed to add connector' });
            res.status(201).json({ 
              message: 'Connector added successfully', 
              id: this.lastID 
            });
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update connector status
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const connectorId = req.params.id;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const dbInstance = db.getDb();
    
    // Ideally check ownership here too, but simplifying for now
    // By getting station owner through a join
    dbInstance.get(
      `SELECT cs.owner_id 
       FROM connectors c 
       JOIN charging_stations cs ON c.station_id = cs.id 
       WHERE c.id = ?`,
      [connectorId],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!result) return res.status(404).json({ error: 'Connector not found' });
        
        if (result.owner_id !== req.user.userId && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Unauthorized' });
        }
        
        dbInstance.run(
          'UPDATE connectors SET status = ? WHERE id = ?',
          [status, connectorId],
          function(err) {
            if (err) return res.status(500).json({ error: 'Failed to update status' });
            res.json({ message: 'Status updated successfully' });
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a connector
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const connectorId = req.params.id;
    const dbInstance = db.getDb();
    
    // Check ownership
    dbInstance.get(
      `SELECT cs.owner_id 
       FROM connectors c 
       JOIN charging_stations cs ON c.station_id = cs.id 
       WHERE c.id = ?`,
      [connectorId],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!result) return res.status(404).json({ error: 'Connector not found' });
        
        if (result.owner_id !== req.user.userId && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Unauthorized' });
        }
        
        dbInstance.run(
          'DELETE FROM connectors WHERE id = ?',
          [connectorId],
          function(err) {
            if (err) return res.status(500).json({ error: 'Failed to delete connector' });
            res.json({ message: 'Connector deleted successfully' });
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
