const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Get all vehicles for the current user
router.get('/', authenticate, (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.all(
    'SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id],
    (err, rows) => {
      if (err) {
        console.error('Error fetching vehicles:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows || []);
    }
  );
});

// Add a new vehicle
router.post('/', authenticate, [
  body('name').trim().notEmpty().withMessage('Vehicle name is required'),
  body('battery_capacity').isFloat({ min: 1, max: 200 }).withMessage('Battery capacity must be between 1 and 200 kWh'),
  body('efficiency').isFloat({ min: 1 }).withMessage('Efficiency must be greater than 0')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, battery_capacity, efficiency } = req.body;
  const dbInstance = db.getDb();

  dbInstance.run(
    'INSERT INTO vehicles (user_id, name, battery_capacity, efficiency) VALUES (?, ?, ?, ?)',
    [req.user.id, name, battery_capacity, efficiency],
    function(err) {
      if (err) {
        console.error('Error adding vehicle:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(201).json({
        id: this.lastID,
        user_id: req.user.id,
        name,
        battery_capacity,
        efficiency
      });
    }
  );
});

// Delete a vehicle
router.delete('/:id', authenticate, (req, res) => {
  const dbInstance = db.getDb();
  const vehicleId = req.params.id;

  // First, verify that the vehicle belongs to the user
  dbInstance.get(
    'SELECT id FROM vehicles WHERE id = ? AND user_id = ?',
    [vehicleId, req.user.id],
    (err, vehicle) => {
      if (err) {
        console.error('Error verifying vehicle ownership:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!vehicle) {
        return res.status(404).json({ error: 'Vehicle not found or unauthorized' });
      }

      // Proceed with deletion
      dbInstance.run(
        'DELETE FROM vehicles WHERE id = ?',
        [vehicleId],
        (err) => {
          if (err) {
            console.error('Error deleting vehicle:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ message: 'Vehicle deleted successfully' });
        }
      );
    }
  );
});

// Update a vehicle
router.put('/:id', authenticate, [
  body('name').trim().notEmpty().withMessage('Vehicle name is required'),
  body('battery_capacity').isFloat({ min: 1, max: 200 }).withMessage('Battery capacity must be between 1 and 200 kWh'),
  body('efficiency').isFloat({ min: 1 }).withMessage('Efficiency must be greater than 0')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, battery_capacity, efficiency } = req.body;
  const dbInstance = db.getDb();
  const vehicleId = req.params.id;

  // Verify ownership
  dbInstance.get(
    'SELECT id FROM vehicles WHERE id = ? AND user_id = ?',
    [vehicleId, req.user.id],
    (err, vehicle) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

      dbInstance.run(
        'UPDATE vehicles SET name = ?, battery_capacity = ?, efficiency = ? WHERE id = ?',
        [name, battery_capacity, efficiency, vehicleId],
        function(err) {
          if (err) return res.status(500).json({ error: 'Database error' });
          res.json({ id: parseInt(vehicleId), name, battery_capacity, efficiency });
        }
      );
    }
  );
});

module.exports = router;
