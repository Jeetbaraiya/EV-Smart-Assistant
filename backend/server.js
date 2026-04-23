require('dotenv').config();
const express = require('express');
console.log("STARTING SERVER.JS - MODULE REQUIRED");
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
console.log("REQUIRING DB...");
const db = require('./config/database');
const authRoutes = require('./routes/auth');
const stationRoutes = require('./routes/stations');
const calculatorRoutes = require('./routes/calculator');
const adminRoutes = require('./routes/admin');
const indiaStationsRoutes = require('./routes/indiaStations');
const vehicleRoutes = require('./routes/vehicles');
const bookingRoutes = require('./routes/bookings');
const connectorRoutes = require('./routes/connectors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database and start server
db.init()
  .then(() => {
    // HTTP + WebSocket server (same port)
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    const broadcastStationStatuses = async () => {
      const dbInstance = db.getDb();
      const stations = await new Promise((resolve, reject) => {
        dbInstance.all(
          `SELECT id, name, city, state, status, slots_total, slots_available, expected_wait_minutes, price_per_kw
           FROM charging_stations
           WHERE is_verified = 1`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      const payload = JSON.stringify({
        type: 'station_status_update',
        stations: stations.map(s => ({
          id: s.id,
          name: s.name,
          city: s.city,
          state: s.state,
          status: s.status,
          slots_total: s.slots_total,
          slots_available: s.slots_available,
          expected_wait_minutes: s.expected_wait_minutes,
          price_per_kw: s.price_per_kw
        }))
      });

      wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(payload);
      });
    };

    // Simulate real-time status changes based on actual bookings.
    const simulateStationStatuses = async () => {
      const dbInstance = db.getDb();

      // Get active confirmed bookings grouped by station
      const activeBookings = await new Promise((resolve) => {
        dbInstance.all(
          `SELECT station_id, COUNT(*) as count 
           FROM bookings 
           WHERE LOWER(status) = 'confirmed' 
           AND start_time <= UTC_TIMESTAMP() 
           AND (end_time IS NULL OR end_time >= UTC_TIMESTAMP())
           GROUP BY station_id`,
          [],
          (err, rows) => {
            if (err) {
              console.error('Active bookings query error:', err);
              resolve({});
            } else {
              const map = {};
              rows.forEach(r => map[r.station_id] = r.count);
              resolve(map);
            }
          }
        );
      });

      const stations = await new Promise((resolve, reject) => {
        dbInstance.all(
          `SELECT id, power_kw, slots_total, availability
           FROM charging_stations
           WHERE is_verified = 1`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      for (const s of stations) {
        const slotsTotal = s.slots_total || 4;
        const bookedCount = activeBookings[s.id] || 0;

        let nextStatus = 'available';
        let nextSlotsAvailable = slotsTotal;
        let nextWait = 0;

        // 1. Check manual override from owner/admin
        if (s.availability && s.availability !== 'available') {
          nextStatus = s.availability; // offline, maintenance, etc.
          nextSlotsAvailable = 0;
          nextWait = 0;
        } 
        // 2. Check real bookings
        else if (bookedCount > 0) {
          nextStatus = 'busy';
          nextSlotsAvailable = Math.max(0, slotsTotal - bookedCount);
          // If all slots are full, calculate a dummy wait time
          nextWait = nextSlotsAvailable === 0 ? Math.min(60, bookedCount * 15) : 0;
        } 
        // 3. Otherwise available
        else {
          nextStatus = 'available';
          nextSlotsAvailable = slotsTotal;
          nextWait = 0;
        }

        dbInstance.run(
          `UPDATE charging_stations
           SET status = ?, slots_available = ?, expected_wait_minutes = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [nextStatus, nextSlotsAvailable, nextWait, s.id]
        );
      }

      await broadcastStationStatuses();
    };

    wss.on('connection', async (ws) => {
      try {
        const dbInstance = db.getDb();
        const stations = await new Promise((resolve, reject) => {
          dbInstance.all(
            `SELECT id, name, city, state, status, slots_total, slots_available, expected_wait_minutes, price_per_kw
             FROM charging_stations
             WHERE is_verified = 1`,
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });

        ws.send(JSON.stringify({
          type: 'station_status_snapshot',
          stations: stations.map(s => ({
            id: s.id,
            name: s.name,
            city: s.city,
            state: s.state,
            status: s.status,
            slots_total: s.slots_total,
            slots_available: s.slots_available,
            expected_wait_minutes: s.expected_wait_minutes,
            price_per_kw: s.price_per_kw
          }))
        }));
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to load station snapshot' }));
      }
    });

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/stations', stationRoutes);
    app.use('/api/calculator', calculatorRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/india-stations', indiaStationsRoutes.router || indiaStationsRoutes);
    app.use('/api/vehicles', vehicleRoutes);
    app.use('/api/bookings', bookingRoutes);
    app.use('/api/connectors', connectorRoutes);

    // Health check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'OK', message: 'EV Smart Assistant API is running', version: '2' });
    });

    // Temporary debug: show which tables exist + create missing ones
    app.get('/api/db-status', async (req, res) => {
      try {
        const dbInstance = db.getDb();
        dbInstance.all('SHOW TABLES', (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          const tables = rows.map(r => Object.values(r)[0]);
          res.json({ tables, count: tables.length });
        });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // Start simulation loop (every 10 seconds)
    setInterval(() => {
      simulateStationStatuses().catch(err => console.error('Status simulation error:', err));
    }, 10000);

    server.listen(PORT, () => {
      console.log(`Server (HTTP + WS) is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

