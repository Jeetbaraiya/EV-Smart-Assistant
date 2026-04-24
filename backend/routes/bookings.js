const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST api/bookings
 * @desc    Create a new charging session booking.
 *          Supports both real DB connectors and virtual connectors
 *          (used for India Network / external stations that have no DB connectors).
 * @access  Private
 */
router.post('/', authenticate, [
  body('station_id').notEmpty().withMessage('Station ID is required'),
  body('start_time').notEmpty().withMessage('Start time is required'),
  body('duration_minutes').isInt({ min: 15, max: 240 }).withMessage('Duration must be 15-240 mins')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array(), error: errors.array()[0]?.msg });

  const {
    station_id,
    connector_id,       // null for virtual connectors
    virtual_connector,  // { type, power, price_per_kwh } for external stations
    start_time,
    duration_minutes,
    energy_kwh = 0,
    total_price = 0
  } = req.body;

  const isVirtual = !connector_id || !!virtual_connector;
  const userId = req.user.id;
  const dbInstance = db.getDb();

  // Normalize ISO strings to MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
  const sqlStart = new Date(start_time).toISOString().slice(0, 19).replace('T', ' ');
  const sqlEnd = new Date(new Date(start_time).getTime() + duration_minutes * 60000)
    .toISOString().slice(0, 19).replace('T', ' ');

  console.log(`[Booking] Normalizing time: ${start_time} -> ${sqlStart}`);

  try {
    // 1. Verify connector status if it's a real connector
    if (!isVirtual) {
      const connector = await new Promise((resolve, reject) => {
        dbInstance.get(
          'SELECT id, status, price_per_kwh FROM connectors WHERE id = ? AND station_id = ?',
          [connector_id, station_id],
          (err, row) => { if (err) reject(err); else resolve(row); }
        );
      });

      if (!connector) return res.status(404).json({ error: 'Connector not found at this station' });
      if (connector.status === 'offline') return res.status(400).json({ error: 'Connector is currently offline' });
    }

    // 2. Conflict Detection (Strict Overlap Check)
    let conflictQuery;
    let conflictParams;

    if (!isVirtual) {
      // Check for real connector overlap
      conflictQuery = `
        SELECT id FROM bookings
        WHERE connector_id = ?
        AND status IN ('pending', 'confirmed')
        AND (start_time < ? AND end_time > ?)
      `;
      conflictParams = [connector_id, sqlEnd, sqlStart];
    } else {
      // Check for virtual/external connector overlap (Match by type label)
      const typeLabel = virtual_connector?.type || 'Unknown';
      conflictQuery = `
        SELECT id FROM bookings
        WHERE station_id = ?
        AND connector_id IS NULL
        AND connector_type_label = ?
        AND status IN ('pending', 'confirmed')
        AND (start_time < ? AND end_time > ?)
      `;
      conflictParams = [station_id, typeLabel, sqlEnd, sqlStart];
    }

    const conflict = await new Promise((resolve, reject) => {
      dbInstance.get(conflictQuery, conflictParams, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (conflict) {
      return res.status(409).json({ 
        error: 'This time slot is already booked. Please choose another time or connector.' 
      });
    }

    // 3. Resolve connector_type_label for storage
    let connTypeLabel = null;
    if (virtual_connector) {
      connTypeLabel = virtual_connector.type || null;
    }

    // 4. Create booking — connector_id is NULL for virtual bookings
    const realConnectorId = isVirtual ? null : connector_id;

    dbInstance.run(
      `INSERT INTO bookings
         (station_id, user_id, connector_id, connector_type_label, start_time, end_time, energy_kwh, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [station_id, userId, realConnectorId, connTypeLabel, sqlStart, sqlEnd, energy_kwh, total_price, 'confirmed'],
      function(error) {
        if (error) {
          // Fallback: try without connector_type_label column (older schema)
          dbInstance.run(
            `INSERT INTO bookings
               (station_id, user_id, connector_id, start_time, end_time, energy_kwh, total_price, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [station_id, userId, realConnectorId, sqlStart, sqlEnd, energy_kwh, total_price, 'confirmed'],
            function(err2) {
              if (err2) {
                console.error('[Booking Fallback Error]', err2);
                return res.status(500).json({ 
                  error: `Booking failed: ${err2.message || 'Unknown error'}`
                });
              }
              res.status(201).json({
                message: 'Booking confirmed!',
                booking: { id: this.lastID, station_id, start_time: sqlStart, end_time: sqlEnd, status: 'confirmed' }
              });
            }
          );
          return;
        }
        res.status(201).json({
          message: 'Booking confirmed!',
          booking: { id: this.lastID, station_id, start_time: sqlStart, end_time: sqlEnd, status: 'confirmed' }
        });
      }
    );
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

/**
 * @route   GET api/bookings/my-bookings
 * @desc    Get all bookings for the authenticated user, with station & connector info
 */
router.get('/my-bookings', authenticate, (req, res) => {
  const userId = req.user.id;
  const dbInstance = db.getDb();

  const query = `
    SELECT
      b.*,
      s.name        AS station_name,
      s.address     AS station_address,
      s.city        AS station_city,
      s.state       AS station_state,
      c.type        AS connector_type,
      c.power       AS connector_power,
      c.price_per_kwh AS connector_price
    FROM bookings b
    JOIN charging_stations s ON b.station_id = s.id
    LEFT JOIN connectors c ON b.connector_id = c.id
    WHERE b.user_id = ? AND b.user_deleted = 0
    ORDER BY b.start_time DESC
  `;

  dbInstance.all(query, [userId], (err, bookings) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ bookings: bookings || [] });
  });
});

/**
 * @route   GET api/bookings/owner-bookings
 * @desc    Get all bookings for stations owned by the authenticated owner
 */
router.get('/owner-bookings', authenticate, (req, res) => {
  const userId = req.user.id;
  const dbInstance = db.getDb();

  const query = `
    SELECT
      b.*,
      s.name        AS station_name,
      s.address     AS station_address,
      s.city        AS station_city,
      s.state       AS station_state,
      c.type        AS connector_type,
      c.power       AS connector_power,
      u.username    AS user_name,
      u.email       AS user_email
    FROM bookings b
    JOIN charging_stations s ON b.station_id = s.id
    LEFT JOIN connectors c ON b.connector_id = c.id
    LEFT JOIN users u ON b.user_id = u.id
    WHERE s.owner_id = ? AND b.owner_deleted = 0
    ORDER BY b.start_time DESC
  `;

  dbInstance.all(query, [userId], (err, bookings) => {
    if (err) {
      console.error('Database error fetching owner bookings:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ bookings: bookings || [] });
  });
});

/**
 * @route   DELETE api/bookings/manage/delete/:id
 * @desc    Permanently delete a booking from history
 */
router.delete('/manage/delete/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const dbInstance = db.getDb();

  console.log(`DELETE request received for session ID: ${id} by user: ${userId}`);

  dbInstance.run(
    "UPDATE bookings SET user_deleted = 1 WHERE id = ? AND user_id = ?",
    [id, userId],
    function(err) {
      if (err) {
        console.error('Delete error:', err);
        return res.status(500).json({ error: 'Delete failed' });
      }
      if (this.changes === 0) {
        console.warn(`No booking found to delete with ID: ${id}`);
        return res.status(404).json({ error: 'Session not found' });
      }
      console.log(`Session ${id} marked as deleted for user ${userId}`);
      res.json({ message: 'Session removed from history' });
    }
  );
});

/**
 * @route   DELETE api/bookings/manage/clear-all
 * @desc    Permanently delete all past (cancelled/completed) bookings
 */
router.delete('/manage/clear-all', authenticate, (req, res) => {
  const userId = req.user.id;
  const dbInstance = db.getDb();

  console.log(`CLEAR ALL HISTORY request received for user: ${userId}`);

  // Use a very permissive check for history compatible with MySQL/MariaDB
  dbInstance.run(
    `UPDATE bookings 
     SET user_deleted = 1 
     WHERE user_id = ? 
     AND (LOWER(status) IN ('cancelled', 'completed') 
          OR (LOWER(status) = 'confirmed' AND start_time < NOW()))`,
    [userId],
    function(err) {
      if (err) {
        console.error('Clear All error:', err);
        return res.status(500).json({ error: 'Failed to clear history' });
      }
      console.log(`History marked as deleted for user ${userId}. Updated ${this.changes} rows.`);
      res.json({ message: `History cleared. ${this.changes} sessions removed.` });
    }
  );
});

/**
 * @route   DELETE api/bookings/manage/owner/delete/:id
 * @desc    Permanently hide a booking from owner history
 */
router.delete('/manage/owner/delete/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const dbInstance = db.getDb();

  // Ensure row belongs to a station owned by the requester
  dbInstance.run(
    `UPDATE bookings 
     SET owner_deleted = 1 
     WHERE id = ? 
     AND station_id IN (SELECT id FROM charging_stations WHERE owner_id = ?)`,
    [id, userId],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to remove session' });
      if (this.changes === 0) return res.status(404).json({ error: 'Session not found or not authorized' });
      res.json({ message: 'Session removed from your history' });
    }
  );
});

/**
 * @route   DELETE api/bookings/manage/owner/clear-all
 * @desc    Permanently hide all past bookings for an owner
 */
router.delete('/manage/owner/clear-all', authenticate, (req, res) => {
  const userId = req.user.id;
  const dbInstance = db.getDb();

  dbInstance.run(
    `UPDATE bookings 
     SET owner_deleted = 1 
     WHERE station_id IN (SELECT id FROM charging_stations WHERE owner_id = ?)
     AND (LOWER(status) IN ('cancelled', 'completed') 
          OR (LOWER(status) = 'confirmed' AND start_time < NOW()))`,
    [userId],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to clear history' });
      res.json({ message: `Owner history cleared. ${this.changes} sessions hidden.` });
    }
  );
});

/**
 * @route   DELETE api/bookings/:id
 * @desc    Cancel a booking (status change)
 */
router.delete('/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const dbInstance = db.getDb();

  console.log(`CANCEL request received for session ID: ${id} by user: ${userId}`);

  // First, check if the booking exists and who it belongs to
  dbInstance.get("SELECT id, user_id, status FROM bookings WHERE id = ?", [id], (err, booking) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.user_id !== userId) {
      return res.status(403).json({ error: 'You are not authorized to cancel this reservation' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'This reservation is already cancelled' });
    }

    // Proceed to cancel
    dbInstance.run(
      "UPDATE bookings SET status = 'cancelled' WHERE id = ?",
      [id],
      function(err) {
        if (err) {
          console.error('Cancellation error:', err);
          return res.status(500).json({ error: 'Cancellation failed' });
        }
        res.json({ message: 'Booking cancelled successfully' });
      }
    );
  });
});

/**
 * @route   GET api/bookings/station/:station_id/booked-slots
 * @desc    Get all booked slots for a specific station on a given date
 */
router.get('/station/:station_id/booked-slots', async (req, res) => {
  const { station_id } = req.params;
  const { date } = req.query; // YYYY-MM-DD
  const dbInstance = db.getDb();

  if (!date) return res.status(400).json({ error: 'Date query parameter is required' });

  // Find all confirmed/pending bookings for this station on this day (IST window)
  // Date comes in as YYYY-MM-DD (IST). 
  // IST 00:00 = UTC -5:30 (Previous Day 18:30)
  // IST 23:59 = UTC +18:30 (Current Day 18:30)
  const startOfDayIST = new Date(`${date}T00:00:00Z`);
  const startWindowUTC = new Date(startOfDayIST.getTime() - (5.5 * 60 * 60 * 1000));
  const endWindowUTC = new Date(startWindowUTC.getTime() + (24 * 60 * 60 * 1000));

  const sqlStart = startWindowUTC.toISOString().slice(0, 19).replace('T', ' ');
  const sqlEnd = endWindowUTC.toISOString().slice(0, 19).replace('T', ' ');

  const query = `
    SELECT start_time, end_time, connector_id, connector_type_label
    FROM bookings
    WHERE station_id = ?
    AND status IN ('pending', 'confirmed')
    AND start_time >= ? AND start_time < ?
  `;

  dbInstance.all(query, [station_id, sqlStart, sqlEnd], (err, rows) => {
    if (err) {
      console.error('[booked-slots] DB Error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ bookedSlots: rows || [] });
  });
});

module.exports = router;
