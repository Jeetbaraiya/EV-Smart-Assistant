const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all verified stations (public)
router.get('/', (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.all(
    `SELECT cs.*, u.username as owner_name,
      (SELECT ROUND(AVG(sr.rating), 1) FROM station_reviews sr WHERE sr.station_id = CAST(cs.id AS CHAR) COLLATE utf8mb4_unicode_ci) as avg_rating,
      (SELECT COUNT(*) FROM station_reviews sr WHERE sr.station_id = CAST(cs.id AS CHAR) COLLATE utf8mb4_unicode_ci) as review_count
     FROM charging_stations cs 
     JOIN users u ON cs.owner_id = u.id 
     WHERE cs.is_verified = 1 
     ORDER BY cs.created_at DESC`,
    (err, stations) => {
      if (err) {
        console.error('Error fetching verified stations:', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      // MySQL stores TINYINT(1) as 0/1 — normalise to boolean for the API response
      const formattedStations = (stations || []).map(station => ({
        ...station,
        is_verified: station.is_verified === 1 || station.is_verified === true,
        avg_rating: station.avg_rating ? parseFloat(station.avg_rating) : null,
        review_count: station.review_count ? parseInt(station.review_count, 10) : 0
      }));
      res.json({ stations: formattedStations });
    }
  );
});

// Advanced station filtering API (for map/stations page and optimizer support)
router.get('/search', (req, res) => {
  const {
    min_power_kw,
    status,
    fast_charger_only,
    lat,
    lng,
    radius_km = 50,
    connector_type
  } = req.query;

  const dbInstance = db.getDb();
  dbInstance.all(
    `SELECT cs.*, u.username as owner_name,
      (SELECT ROUND(AVG(sr.rating), 1) FROM station_reviews sr WHERE sr.station_id = CAST(cs.id AS CHAR) COLLATE utf8mb4_unicode_ci) as avg_rating,
      (SELECT COUNT(*) FROM station_reviews sr WHERE sr.station_id = CAST(cs.id AS CHAR) COLLATE utf8mb4_unicode_ci) as review_count
     FROM charging_stations cs
     JOIN users u ON cs.owner_id = u.id
     WHERE cs.is_verified = 1
       AND cs.latitude IS NOT NULL
       AND cs.longitude IS NOT NULL`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error', details: err.message });
      }

      let results = (rows || []).map(s => ({
        ...s,
        avg_rating: s.avg_rating ? parseFloat(s.avg_rating) : null,
        review_count: s.review_count ? parseInt(s.review_count, 10) : 0
      }));

      if (min_power_kw != null && !Number.isNaN(parseFloat(min_power_kw))) {
        const minP = parseFloat(min_power_kw);
        results = results.filter(s => (s.power_kw || 0) >= minP);
      }

      if (status) {
        results = results.filter(s => (s.status || s.availability || 'available') === status);
      }

      if (String(fast_charger_only).toLowerCase() === 'true') {
        results = results.filter(s => (s.power_kw || 0) >= 50);
      }

      if (connector_type) {
        const needle = String(connector_type).toLowerCase();
        results = results.filter(s => String(s.connector_type || '').toLowerCase().includes(needle));
      }

      if (lat != null && lng != null) {
        const userLat = parseFloat(lat);
        const userLng = parseFloat(lng);
        const radius = parseFloat(radius_km);
        if (!Number.isNaN(userLat) && !Number.isNaN(userLng) && !Number.isNaN(radius)) {
          const R = 6371;
          results = results
            .map(station => {
              const dLat = (station.latitude - userLat) * Math.PI / 180;
              const dLng = (station.longitude - userLng) * Math.PI / 180;
              const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(userLat * Math.PI / 180) * Math.cos(station.latitude * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const distance = R * c;
              return { ...station, distance: Math.round(distance * 10) / 10 };
            })
            .filter(s => s.distance <= radius)
            .sort((a, b) => a.distance - b.distance);
        }
      }

      res.json({ stations: results, total: results.length });
    }
  );
});

// Get current live status for verified stations
// (Works with the WebSocket simulation and also supports initial page loads.)
router.get('/status', (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.all(
    `SELECT id, name, city, state, status, slots_total, slots_available, expected_wait_minutes
     FROM charging_stations
     WHERE is_verified = 1`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      const stations = (rows || []).map(s => ({
        id: s.id,
        name: s.name,
        city: s.city,
        state: s.state,
        status: s.status,
        slots_total: s.slots_total,
        slots_available: s.slots_available,
        expected_wait_minutes: s.expected_wait_minutes
      }));
      res.json({ stations });
    }
  );
});

// Get station by ID
router.get('/:id', (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.get(
    `SELECT cs.*, u.username as owner_name,
      (SELECT ROUND(AVG(sr.rating), 1) FROM station_reviews sr WHERE sr.station_id = CAST(cs.id AS CHAR) COLLATE utf8mb4_unicode_ci) as avg_rating,
      (SELECT COUNT(*) FROM station_reviews sr WHERE sr.station_id = CAST(cs.id AS CHAR) COLLATE utf8mb4_unicode_ci) as review_count
     FROM charging_stations cs 
     JOIN users u ON cs.owner_id = u.id 
     WHERE cs.id = ? AND cs.is_verified = 1`,
    [req.params.id],
    (err, station) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!station) {
        return res.status(404).json({ error: 'Station not found' });
      }
      res.json({
        station: {
          ...station,
          avg_rating: station.avg_rating ? parseFloat(station.avg_rating) : null,
          review_count: station.review_count ? parseInt(station.review_count, 10) : 0
        }
      });
    }
  );
});

// Get reviews for a station (db station numeric id or india_x id)
router.get('/:id/reviews', (req, res) => {
  const dbInstance = db.getDb();
  const stationId = String(req.params.id);
  dbInstance.all(
    `SELECT sr.id, sr.station_id, sr.user_id, sr.rating, sr.comment, sr.created_at, sr.updated_at, u.username
     FROM station_reviews sr
     JOIN users u ON sr.user_id = u.id
     WHERE sr.station_id = ?
     ORDER BY sr.updated_at DESC`,
    [stationId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      const reviews = rows || [];
      const avgRating = reviews.length > 0
        ? Math.round((reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length) * 10) / 10
        : null;
      res.json({ reviews, avgRating, total: reviews.length });
    }
  );
});

// Create/update current user's review for a station
router.post('/:id/reviews', authenticate, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 1000 }).withMessage('comment must be <= 1000 chars')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const stationId = String(req.params.id);
  const { rating, comment = '' } = req.body;
  const userId = req.user.id;
  const dbInstance = db.getDb();

  // Upsert via INSERT OR REPLACE semantics using manual check to preserve id
  dbInstance.get(
    `SELECT id FROM station_reviews WHERE station_id = ? AND user_id = ?`,
    [stationId, userId],
    (checkErr, existing) => {
      if (checkErr) return res.status(500).json({ error: 'Database error' });
      if (existing) {
        dbInstance.run(
          `UPDATE station_reviews
           SET rating = ?, comment = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [rating, comment, existing.id],
          function (updateErr) {
            if (updateErr) return res.status(500).json({ error: 'Database error' });
            res.json({ message: 'Review updated successfully' });
          }
        );
        return;
      }

      dbInstance.run(
        `INSERT INTO station_reviews (station_id, user_id, rating, comment)
         VALUES (?, ?, ?, ?)`,
        [stationId, userId, rating, comment],
        function (insertErr) {
          if (insertErr) return res.status(500).json({ error: 'Database error' });
          res.status(201).json({ message: 'Review added successfully', reviewId: this.lastID });
        }
      );
    }
  );
});

// Create station (owner only)
router.post('/', authenticate, authorize('owner', 'admin'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('connector_type').trim().notEmpty().withMessage('Connector type is required'),
  body('power_kw').isFloat({ min: 0 }).withMessage('Power must be positive'),
  body('price_per_kw').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Price per kW must be a positive number'),
  body('latitude').optional({ checkFalsy: true }).isFloat().withMessage('Latitude must be a number'),
  body('longitude').optional({ checkFalsy: true }).isFloat().withMessage('Longitude must be a number')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if owner is verified
    if (req.user.role === 'owner' && !req.user.is_verified) {
      return res.status(403).json({ error: 'Owner account must be verified by admin to add stations' });
    }

    const {
      name,
      address,
      city,
      state,
      zip_code,
      latitude,
      longitude,
      connector_type,
      power_kw,
      price_per_kw,
      availability = 'available'
    } = req.body;

    const dbInstance = db.getDb();
    dbInstance.run(
      `INSERT INTO charging_stations 
       (name, address, city, state, zip_code, latitude, longitude, connector_type, power_kw, price_per_kw, availability, owner_id, is_verified) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, address, city, state, zip_code || null, latitude || null, longitude || null, connector_type, power_kw, price_per_kw || null, availability, req.user.id, req.user.role === 'admin' ? 1 : 0],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error creating station' });
        }

        dbInstance.get('SELECT * FROM charging_stations WHERE id = ?', [this.lastID], (err, station) => {
          if (err) {
            return res.status(500).json({ error: 'Error fetching created station' });
          }
          res.status(201).json({
            message: 'Station created successfully',
            station
          });
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update station (owner of station or admin)
router.put('/:id', authenticate, authorize('owner', 'admin'), [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('address').optional().trim().notEmpty().withMessage('Address cannot be empty'),
  body('power_kw').optional().isFloat({ min: 0 }).withMessage('Power must be positive'),
  body('price_per_kw').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Price must be a number'),
  body('latitude').optional({ checkFalsy: true }).isFloat().withMessage('Latitude must be a number'),
  body('longitude').optional({ checkFalsy: true }).isFloat().withMessage('Longitude must be a number')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const dbInstance = db.getDb();
    
    // Check if station exists and user has permission
    dbInstance.get('SELECT * FROM charging_stations WHERE id = ?', [req.params.id], (err, station) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!station) {
        return res.status(404).json({ error: 'Station not found' });
      }

      // Check permission
      if (req.user.role === 'owner' && station.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only update your own stations' });
      }

      // Build update query
      const updates = [];
      const values = [];

      Object.keys(req.body).forEach(key => {
        if (['name', 'address', 'city', 'state', 'zip_code', 'latitude', 'longitude', 'connector_type', 'power_kw', 'price_per_kw', 'availability'].includes(key)) {
          updates.push(`${key} = ?`);
          values.push(req.body[key]);
        }
      });

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(req.params.id);

      dbInstance.run(
        `UPDATE charging_stations SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error updating station' });
          }

          dbInstance.get('SELECT * FROM charging_stations WHERE id = ?', [req.params.id], (err, updatedStation) => {
            if (err) {
              return res.status(500).json({ error: 'Error fetching updated station' });
            }
            res.json({
              message: 'Station updated successfully',
              station: updatedStation
            });
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete station (owner of station or admin)
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const dbInstance = db.getDb();

    dbInstance.get('SELECT * FROM charging_stations WHERE id = ?', [id], (err, station) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!station) return res.status(404).json({ error: 'Station not found' });

        // Fetch connectors for this station
        dbInstance.all('SELECT * FROM connectors WHERE station_id = ?', [id], (err, connectors) => {
            if (err) return res.status(500).json({ error: 'Error fetching connectors' });
            station.connectors = connectors || [];
            res.json({ station });
        });
    });
});

router.delete('/:id', authenticate, authorize('owner', 'admin'), (req, res) => {
  const dbInstance = db.getDb();
  
  dbInstance.get('SELECT * FROM charging_stations WHERE id = ?', [req.params.id], (err, station) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Check permission
    if (req.user.role === 'owner' && station.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own stations' });
    }

    dbInstance.run('DELETE FROM charging_stations WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error deleting station' });
      }
      res.json({ message: 'Station deleted successfully' });
    });
  });
});

// Get owner's stations
router.get('/owner/my-stations', authenticate, authorize('owner', 'admin'), (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.all(
    `SELECT cs.*, 
      (SELECT ROUND(AVG(sr.rating), 1) FROM station_reviews sr WHERE sr.station_id = CAST(cs.id AS CHAR) COLLATE utf8mb4_unicode_ci) as avg_rating,
      (SELECT COUNT(*) FROM station_reviews sr WHERE sr.station_id = CAST(cs.id AS CHAR) COLLATE utf8mb4_unicode_ci) as review_count
     FROM charging_stations cs 
     WHERE cs.owner_id = ? 
     ORDER BY cs.created_at DESC`,
    [req.user.id],
    (err, stations) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      const formatted = (stations || []).map(st => ({
        ...st,
        avg_rating: st.avg_rating ? parseFloat(st.avg_rating) : null,
        review_count: st.review_count ? parseInt(st.review_count, 10) : 0
      }));
      res.json({ stations: formatted });
    }
  );
});

// Get owner's station reviews
router.get('/owner/reviews', authenticate, authorize('owner', 'admin'), (req, res) => {
  const dbInstance = db.getDb();
  const query = `
    SELECT sr.id, sr.rating, sr.comment, sr.created_at, u.username, cs.name as station_name
    FROM station_reviews sr
    JOIN charging_stations cs ON sr.station_id = cs.id
    JOIN users u ON sr.user_id = u.id
    WHERE cs.owner_id = ?
    ORDER BY sr.created_at DESC
  `;
  dbInstance.all(query, [req.user.id], (err, reviews) => {
    if (err) {
      console.error('Error fetching owner reviews:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    let averageRating = 0;
    if (reviews && reviews.length > 0) {
      const sum = reviews.reduce((acc, rev) => acc + (Number(rev.rating) || 0), 0);
      averageRating = (sum / reviews.length).toFixed(1);
    }
    
    res.json({ reviews: reviews || [], averageRating });
  });
});

// Get owner dashboard stats (real-time revenue, bookings, chart data)
router.get('/owner/stats', authenticate, authorize('owner', 'admin'), (req, res) => {
  const dbInstance = db.getDb();
  const ownerId = req.user.id;

  // 1. Get Monthly Revenue & Total Bookings for this month
  const monthlyStatsSql = `
    SELECT 
      SUM(CASE 
        WHEN LOWER(b.status) = 'completed' THEN b.total_price 
        WHEN LOWER(b.status) = 'confirmed' AND b.end_time < UTC_TIMESTAMP() THEN b.total_price
        ELSE 0 
      END) as monthly_revenue,
      COUNT(CASE WHEN LOWER(b.status) = 'confirmed' AND b.end_time >= UTC_TIMESTAMP() THEN 1 END) as total_bookings
    FROM bookings b
    JOIN charging_stations cs ON b.station_id = cs.id
    WHERE cs.owner_id = ? 
    AND b.created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')
  `;

  // 2. Get 14-day trend for charts
  const trendSql = `
    SELECT 
      DATE_FORMAT(b.created_at, '%b %d') as label,
      SUM(CASE 
        WHEN LOWER(b.status) = 'completed' THEN b.total_price 
        WHEN LOWER(b.status) = 'confirmed' AND b.end_time < UTC_TIMESTAMP() THEN b.total_price
        ELSE 0 
      END) as revenue,
      COUNT(b.id) as usage_count
    FROM bookings b
    JOIN charging_stations cs ON b.station_id = cs.id
    WHERE cs.owner_id = ?
    AND b.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY)
    GROUP BY DATE(b.created_at)
    ORDER BY DATE(b.created_at) ASC
  `;

  dbInstance.get(monthlyStatsSql, [ownerId], (err, stats) => {
    if (err) return res.status(500).json({ error: 'Stats error', details: err.message });

    dbInstance.all(trendSql, [ownerId], (err, trend) => {
      if (err) return res.status(500).json({ error: 'Trend error', details: err.message });

      res.json({
        monthlyRevenue: stats.monthly_revenue || 0,
        totalBookings: stats.total_bookings || 0,
        chartData: trend || []
      });
    });
  });
});

// Search stations by location (find nearest)
router.get('/search/nearby', (req, res) => {
  const { lat, lng, radius = 50 } = req.query; // radius in km

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const radiusKm = parseFloat(radius);

  if (isNaN(userLat) || isNaN(userLng) || isNaN(radiusKm)) {
    return res.status(400).json({ error: 'Invalid coordinates or radius' });
  }

  const dbInstance = db.getDb();
  dbInstance.all(
    `SELECT cs.*, u.username as owner_name 
     FROM charging_stations cs 
     JOIN users u ON cs.owner_id = u.id 
     WHERE cs.is_verified = 1 
     AND cs.latitude IS NOT NULL 
     AND cs.longitude IS NOT NULL`,
    (err, stations) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Calculate distance using Haversine formula
      const R = 6371; // Earth's radius in km
      const stationsWithDistance = stations.map(station => {
        const dLat = (station.latitude - userLat) * Math.PI / 180;
        const dLng = (station.longitude - userLng) * Math.PI / 180;
        const a = 
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(userLat * Math.PI / 180) * Math.cos(station.latitude * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return { ...station, distance: Math.round(distance * 10) / 10 };
      });

      // Filter by radius and sort by distance
      const nearbyStations = stationsWithDistance
        .filter(s => s.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance);

      res.json({
        stations: nearbyStations,
        total: nearbyStations.length,
        location: { lat: userLat, lng: userLng },
        radius: radiusKm
      });
    }
  );
});

module.exports = router;

