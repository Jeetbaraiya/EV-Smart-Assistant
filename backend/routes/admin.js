const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { sampleIndiaStations } = require('./indiaStations');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// Get all owners (pending and verified)
router.get('/owners', (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.all(
    `SELECT id, username, email, role, is_verified, created_at,
     (SELECT COUNT(*) FROM charging_stations WHERE owner_id = users.id) as station_count
     FROM users 
     WHERE role = 'owner' 
     ORDER BY created_at DESC`,
    (err, owners) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ owners });
    }
  );
});

// Get all regular users (User Directory)
router.get('/users', (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.all(
    `SELECT id, username, email, role, created_at FROM users WHERE role = 'user' ORDER BY created_at DESC`,
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ users });
    }
  );
});

// Verify owner
router.post('/owners/:id/verify', (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.run(
    'UPDATE users SET is_verified = 1 WHERE id = ? AND role = ?',
    [req.params.id, 'owner'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Owner not found' });
      }
      res.json({ message: 'Owner verified successfully' });
    }
  );
});

// Unverify owner
router.post('/owners/:id/unverify', (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.run(
    'UPDATE users SET is_verified = 0 WHERE id = ? AND role = ?',
    [req.params.id, 'owner'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Owner not found' });
      }
      res.json({ message: 'Owner unverified successfully' });
    }
  );
});

// Get all stations (including unverified)
router.get('/stations', (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.all(
    `SELECT cs.*, u.username as owner_name, u.email as owner_email
     FROM charging_stations cs 
     JOIN users u ON cs.owner_id = u.id 
     ORDER BY cs.created_at DESC`,
    (err, stations) => {
      if (err) {
        console.error('Error fetching all stations:', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      // Ensure is_verified is properly formatted
      const formattedStations = (stations || []).map(station => ({
        ...station,
        is_verified: station.is_verified === 1 || station.is_verified === true
      }));
      res.json({ stations: formattedStations });
    }
  );
});

// Verify station
router.post('/stations/:id/verify', (req, res) => {
  const dbInstance = db.getDb();
  const stationId = parseInt(req.params.id);
  
  if (isNaN(stationId)) {
    return res.status(400).json({ error: 'Invalid station ID' });
  }

  dbInstance.run(
    'UPDATE charging_stations SET is_verified = 1 WHERE id = ?',
    [stationId],
    function(err) {
      if (err) {
        console.error('Error verifying station:', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Station not found' });
      }
      res.json({ 
        message: 'Station verified successfully',
        stationId: stationId
      });
    }
  );
});

// Unverify station
router.post('/stations/:id/unverify', (req, res) => {
  const dbInstance = db.getDb();
  const stationId = parseInt(req.params.id);
  
  if (isNaN(stationId)) {
    return res.status(400).json({ error: 'Invalid station ID' });
  }

  dbInstance.run(
    'UPDATE charging_stations SET is_verified = 0 WHERE id = ?',
    [stationId],
    function(err) {
      if (err) {
        console.error('Error unverifying station:', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Station not found' });
      }
      res.json({ 
        message: 'Station unverified successfully',
        stationId: stationId
      });
    }
  );
});

// Delete station (Admin only)
router.delete('/stations/:id', (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.run(
    'DELETE FROM charging_stations WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Station not found' });
      }
      res.json({ message: 'Station deleted successfully' });
    }
  );
});

// Delete user
router.delete('/users/:id', (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.run(
    'DELETE FROM users WHERE id = ? AND role = ?',
    [req.params.id, 'user'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ message: 'User deleted successfully' });
    }
  );
});

// Delete owner
router.delete('/owners/:id', (req, res) => {
  const dbInstance = db.getDb();
  const ownerId = req.params.id;

  // Delete the owner's stations first, then the owner account (chained MySQL queries)
  dbInstance.run('DELETE FROM charging_stations WHERE owner_id = ?', [ownerId], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to delete owner stations' });
    
    dbInstance.run(
      'DELETE FROM users WHERE id = ? AND role = ?',
      [ownerId, 'owner'],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Owner not found' });
        }
        res.json({ message: 'Owner and their stations deleted successfully' });
      }
    );
  });
});

// Get dashboard stats
router.get('/stats', (req, res) => {
  const dbInstance = db.getDb();
  
  const INDIA_COUNT = sampleIndiaStations.length;
  const INDIA_POWER = sampleIndiaStations.reduce((sum, s) => sum + (s.power_kw || 0), 0);

  const stats = {};
  let completed = 0;
  const total = 11;

  const checkDone = () => {
    completed++;
    if (completed === total) {
      // Merge India network stations into totals
      stats.indiaStations   = INDIA_COUNT;
      stats.totalStations   = (stats.dbStations || 0) + INDIA_COUNT;
      stats.totalPowerCapacity = Math.round((stats.dbPowerCapacity || 0) + INDIA_POWER);
      res.json({ stats });
    }
  };

  // Total users
  dbInstance.get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['user'], (err, result) => {
    if (!err) stats.totalUsers = result.count;
    checkDone();
  });

  // Total owners
  dbInstance.get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['owner'], (err, result) => {
    if (!err) stats.totalOwners = result.count;
    checkDone();
  });

  // Verified owners
  dbInstance.get('SELECT COUNT(*) as count FROM users WHERE role = ? AND is_verified = 1', ['owner'], (err, result) => {
    if (!err) stats.verifiedOwners = result.count;
    checkDone();
  });

  // Pending owners
  dbInstance.get('SELECT COUNT(*) as count FROM users WHERE role = ? AND is_verified = 0', ['owner'], (err, result) => {
    if (!err) stats.pendingOwners = result.count;
    checkDone();
  });

  // DB stations (owner-added)
  dbInstance.get('SELECT COUNT(*) as count FROM charging_stations', [], (err, result) => {
    if (!err) stats.dbStations = result.count;
    checkDone();
  });

  // Verified DB stations
  dbInstance.get('SELECT COUNT(*) as count FROM charging_stations WHERE is_verified = 1', [], (err, result) => {
    if (!err) stats.verifiedStations = result.count;
    checkDone();
  });

  // Pending DB stations
  dbInstance.get('SELECT COUNT(*) as count FROM charging_stations WHERE is_verified = 0', [], (err, result) => {
    if (!err) stats.pendingStations = result.count;
    checkDone();
  });

  // DB power capacity (verified owner stations)
  dbInstance.get('SELECT SUM(power_kw) as total FROM charging_stations WHERE is_verified = 1', [], (err, result) => {
    if (!err) stats.dbPowerCapacity = result.total || 0;
    checkDone();
  });

  // Global booking counts for summary tiles
  const nowUtc = new Date().toISOString().slice(0, 19).replace('T', ' ');
  dbInstance.get(`
    SELECT 
      COALESCE(SUM(CASE WHEN LOWER(status) = 'confirmed' AND (end_time IS NULL OR end_time >= ?) THEN 1 ELSE 0 END), 0) as confirmed,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'completed' OR (LOWER(status) = 'confirmed' AND end_time < ?) THEN 1 ELSE 0 END), 0) as completed
    FROM bookings
  `, [nowUtc, nowUtc], (err, result) => {
    if (!err && result) {
      stats.confirmedBookings = result.confirmed || 0;
      stats.completedBookings = result.completed || 0;
    } else {
      stats.confirmedBookings = 0;
      stats.completedBookings = 0;
    }
    checkDone();
  });

  // Station status distribution for charts
  // A station is 'busy' if it has at least one confirmed booking happening right now
  dbInstance.all(
    `SELECT 
        cs.id, 
        COALESCE(cs.availability, 'available') as db_status,
        (SELECT COUNT(*) FROM bookings b 
         WHERE b.station_id = cs.id 
         AND LOWER(b.status) = 'confirmed' 
         AND b.start_time <= UTC_TIMESTAMP() 
         AND b.end_time >= UTC_TIMESTAMP()) as active_bookings
     FROM charging_stations cs
     WHERE cs.is_verified = 1`,
    [],
    (err, rows) => {
      if (!err) {
        const dist = { available: 0, busy: 0, offline: 0 };
        (rows || []).forEach(r => {
          const statusStr = (r.db_status || '').toLowerCase();
          if (statusStr === 'unavailable' || statusStr === 'offline' || statusStr === 'maintenance') {
            dist.offline++;
          } else if (r.active_bookings > 0) {
            dist.busy++;
          } else {
            dist.available++;
          }
        });
        
        // Ensure INDIA stations are counted as available if they aren't in DB
        // But since dbStations + INDIA_COUNT is total, we should add INDIA_COUNT to available
        dist.available += INDIA_COUNT;
        
        stats.stationStatusDistribution = dist;
      }
      checkDone();
    }
  );

  // Daily route-planner usage trend (last 7 days, including days with 0 usage)
  dbInstance.all(
    `SELECT DATE(DATE_SUB(UTC_TIMESTAMP(), INTERVAL seq DAY)) as day
     FROM (SELECT 0 AS seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) as seqs`,
    [],
    (err, days) => {
      if (err) {
        checkDone();
        return;
      }
      
      const last7Days = days.map(d => ({ 
        day: d.day instanceof Date ? d.day.toISOString().split('T')[0] : d.day, 
        count: 0 
      })).reverse();

      dbInstance.all(
        `SELECT DATE(created_at) as day, COUNT(*) as count
         FROM usage_events
         WHERE event_type IN ('optimize_route', 'multi_stop_plan')
           AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
         GROUP BY DATE(created_at)`,
        [],
        (err, rows) => {
          if (!err && rows) {
            rows.forEach(r => {
              const rDay = r.day instanceof Date ? r.day.toISOString().split('T')[0] : r.day;
              const idx = last7Days.findIndex(d => d.day === rDay);
              if (idx !== -1) last7Days[idx].count = r.count;
            });
          }
          stats.routeUsageTrend = last7Days;
          checkDone();
        }
      );
    }
  );
});

// ── GET /admin/bookings — All Bookings (Global Admin View) ────────────────
router.get('/bookings', (req, res) => {
  const dbInstance = db.getDb();
  const { date, station_id, status, search, sort = 'date_desc', page = 1, limit = 20 } = req.query;

  const pageNum  = Math.max(1, parseInt(page)  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset   = (pageNum - 1) * limitNum;

  const conditions = [];
  const params     = [];

  if (date) {
    conditions.push("DATE(b.start_time) = ?");
    params.push(date);
  }
  if (station_id) {
    conditions.push("b.station_id = ?");
    params.push(station_id);
  }
  if (status) {
    conditions.push("LOWER(b.status) = LOWER(?)");
    params.push(status);
  }
  if (search) {
    conditions.push("(u.username LIKE ? OR u.email LIKE ? OR cs.name LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Determine ORDER BY
  const sortMap = {
    date_desc:   'b.start_time DESC',
    date_asc:    'b.start_time ASC',
    status:      'b.status ASC, b.start_time DESC',
    station:     'cs.name ASC, b.start_time DESC',
  };
  const orderBy = sortMap[sort] || 'b.start_time DESC';

  // Count query for pagination
  const countQuery = `
    SELECT COUNT(*) as total
    FROM bookings b
    LEFT JOIN users u            ON b.user_id    = u.id
    LEFT JOIN charging_stations cs ON b.station_id = cs.id
    ${where}
  `;

  dbInstance.get(countQuery, params, (err, countRow) => {
    if (err) {
      console.error('[admin/bookings] Count error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    const total = countRow?.total || 0;

    const nowUtc = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const dataQuery = `
      SELECT
        b.*,
        u.username   AS user_name,
        u.email      AS user_email,
        cs.name      AS station_name,
        cs.city      AS station_city,
        cs.state     AS station_state,
        CASE 
          WHEN LOWER(b.status) = 'confirmed' AND b.end_time < ? THEN 'completed'
          ELSE LOWER(b.status)
        END as display_status
      FROM bookings b
      LEFT JOIN users u             ON b.user_id    = u.id
      LEFT JOIN charging_stations cs ON b.station_id = cs.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    dbInstance.all(dataQuery, [nowUtc, ...params, limitNum, offset], (err2, bookings) => {
      if (err2) {
        console.error('[admin/bookings] Data error:', err2);
        return res.status(500).json({ error: 'Database error', details: err2.message });
      }
      res.json({
        bookings: bookings || [],
        pagination: {
          total,
          page:       pageNum,
          limit:      limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    });
  });
});

// ── GET /admin/bookings/stats — Summary analytics ─────────────────────────
router.get('/bookings/stats', (req, res) => {
  const dbInstance = db.getDb();

  const query = `
    SELECT 
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'confirmed' AND (end_time IS NULL OR TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), end_time) >= 0) THEN 1 ELSE 0 END), 0) as confirmed,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'completed' OR (LOWER(status) = 'confirmed' AND TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), end_time) < 0) THEN 1 ELSE 0 END), 0) as completed
    FROM bookings
  `;

  dbInstance.get(query, [], (err, row) => {
    if (err) {
      console.error('[admin/bookings/stats] Error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log('[admin/bookings/stats] Calculated stats:', row);

    const stats = {
      total:     row?.total || 0,
      confirmed: row?.confirmed || 0,
      cancelled: row?.cancelled || 0,
      completed: row?.completed || 0
    };
    
    res.json({ stats });
  });
});

// ── GET /admin/bookings/stations-list — Distinct stations that have bookings ──
router.get('/bookings/stations-list', (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.all(
    `SELECT DISTINCT b.station_id, COALESCE(cs.name, b.station_id) as station_name
     FROM bookings b
     LEFT JOIN charging_stations cs ON b.station_id = cs.id
     ORDER BY station_name ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ stations: rows || [] });
    }
  );
});

// Get all reviews for moderation
router.get('/reviews', (req, res) => {
  const dbInstance = db.getDb();
  const query = `
    SELECT sr.id, sr.rating, sr.comment, sr.created_at, u.username, cs.name as station_name
    FROM station_reviews sr
    JOIN charging_stations cs ON sr.station_id = cs.id
    JOIN users u ON sr.user_id = u.id
    ORDER BY sr.created_at DESC
  `;
  dbInstance.all(query, [], (err, reviews) => {
    if (err) {
      console.error('Error fetching admin reviews:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ reviews: reviews || [] });
  });
});

module.exports = router;

