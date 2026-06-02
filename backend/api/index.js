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

let isDbInitialized = false;

// Middleware to ensure DB is initialized on Vercel cold starts
app.use(async (req, res, next) => {
  if (!isDbInitialized) {
    try {
      await db.init();
      isDbInitialized = true;
    } catch (error) {
      console.error("Vercel DB Init Error:", error);
      return res.status(200).json({ 
        error: 'Database initialization failed', 
        message: error.message, 
        host: process.env.DB_HOST,
        user: process.env.DB_USER
      });
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
