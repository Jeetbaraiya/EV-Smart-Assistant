require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('../config/database');

const authRoutes = require('../routes/auth');
const stationRoutes = require('../routes/stations');
const calculatorRoutes = require('../routes/calculator');
const adminRoutes = require('../routes/admin');
const indiaStationsRoutes = require('../routes/indiaStations');
const vehicleRoutes = require('../routes/vehicles');
const bookingRoutes = require('../routes/bookings');
const connectorRoutes = require('../routes/connectors');

const app = express();

app.use(cors({
  origin: [
    "https://evassist.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  credentials: true
}));
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/debug-db', async (req, res) => {
  const results = [];
  try {
    results.push('1. Starting debug');
    results.push(`2. DB_HOST present: ${!!process.env.DB_HOST}`);
    results.push(`3. DB_USER present: ${!!process.env.DB_USER}`);
    
    const mysql = require('mysql2/promise');
    results.push('4. Attempting direct mysql2 connection...');
    
    const hostRaw = process.env.DB_HOST || '127.0.0.1';
    const connection = await mysql.createConnection({
      host: hostRaw,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: hostRaw !== '127.0.0.1' ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 5000
    });
    
    results.push('5. Connection successful!');
    
    const [rows] = await connection.query('SELECT 1 as ok');
    results.push(`6. Query successful: ${JSON.stringify(rows)}`);
    
    await connection.end();
    res.json({ success: true, steps: results });
  } catch (error) {
    results.push(`ERROR: ${error.message}`);
    res.json({ success: false, steps: results, error: error.message, stack: error.stack });
  }
});

let isDbInitialized = false;

// Middleware to ensure DB is initialized on Vercel cold starts
app.use(async (req, res, next) => {
  if (!isDbInitialized) {
    try {
      await db.init();
      isDbInitialized = true;
    } catch (error) {
      console.error("Vercel DB Init Error:", error);
      return res.status(500).json({ error: 'Database initialization failed' });
    }
  }
  next();
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
  res.json({ status: 'OK', message: 'EV Smart Assistant Vercel API is running' });
});

module.exports = app;
