const express = require('express');
const db = require('../config/database');
const router = express.Router();

// Sample India charging stations data (for demonstration)
// In production, this would fetch from real APIs like Statiq, PlugKart, etc.
const sampleIndiaStations = [
  // --- Bhavnagar to Ahmedabad Highway (NH 751 / NH 47) ---
  { id: 'ind_hwy_1', name: 'NH-751 Fast Charger Bagodara', city: 'Bagodara', state: 'Gujarat', latitude: 22.4345, longitude: 72.1345, network: 'Statiq', power_kw: 60, connector_type: 'CCS2', availability: 'available' },
  { id: 'ind_hwy_2', name: 'Dhandhuka Highway Hub', city: 'Dhandhuka', state: 'Gujarat', latitude: 22.3789, longitude: 71.9856, network: 'Tata Power', power_kw: 30, connector_type: 'CCS2', availability: 'available' },
  { id: 'ind_hwy_3', name: 'Bavla EV Point', city: 'Bavla', state: 'Gujarat', latitude: 22.8345, longitude: 72.3678, network: 'Jio-bp', power_kw: 50, connector_type: 'CCS2', availability: 'available' },

  // --- Ahmedabad to Rajkot / Somnath Highway (NH 47 / NH 27) ---
  { id: 'ind_hwy_4', name: 'Limbdi Highway Plaza Charging', city: 'Limbdi', state: 'Gujarat', latitude: 22.5678, longitude: 71.8901, network: 'Statiq', power_kw: 120, connector_type: 'CCS2', availability: 'available' },
  { id: 'ind_hwy_5', name: 'Chotila Hill View EV Hub', city: 'Chotila', state: 'Gujarat', latitude: 22.4234, longitude: 71.1890, network: 'Tata Power', power_kw: 60, connector_type: 'CCS2', availability: 'available' },
  { id: 'ind_hwy_6', name: 'Gondal Bypass Fast DC', city: 'Gondal', state: 'Gujarat', latitude: 21.9678, longitude: 70.7890, network: 'Zeon', power_kw: 50, connector_type: 'CCS2', availability: 'available' },
  { id: 'ind_hwy_7', name: 'Jetpur Junction EV Stop', city: 'Jetpur', state: 'Gujarat', latitude: 21.7543, longitude: 70.6234, network: 'Statiq', power_kw: 60, connector_type: 'CCS2', availability: 'available' },
  { id: 'ind_hwy_8', name: 'Junagadh Gateway Charging', city: 'Junagadh', state: 'Gujarat', latitude: 21.5234, longitude: 70.4567, network: 'Tata Power', power_kw: 30, connector_type: 'CCS2', availability: 'available' },
  { id: 'ind_hwy_9', name: 'Veraval Coast EV Park', city: 'Veraval', state: 'Gujarat', latitude: 20.9123, longitude: 70.3678, network: 'Statiq', power_kw: 60, connector_type: 'CCS2', availability: 'available' },

  // --- City Center Stations (Ahmedabad) ---
  { id: 'ind_city_1', name: 'Ahmedabad Riverfront Mall EV', city: 'Ahmedabad', state: 'Gujarat', latitude: 23.0225, longitude: 72.5714, network: 'Jio-bp', power_kw: 50, connector_type: 'CCS2', availability: 'available' },
  { id: 'ind_city_2', name: 'C.G. Road Charging Point', city: 'Ahmedabad', state: 'Gujarat', latitude: 23.0333, longitude: 72.5621, network: 'Tata Power', power_kw: 25, connector_type: 'CCS2', availability: 'available' }
];

// Get all India charging stations

router.get('/', (req, res) => {
  try {
    // In production, you would fetch from real APIs here
    // Example: const stations = await fetchFromStatiqAPI();
    // For now, returning sample data

    const { city, state, network, available_only, fast_charger_only, min_power_kw } = req.query;
    let filteredStations = [...sampleIndiaStations];

    // Filter by city if provided
    if (city) {
      filteredStations = filteredStations.filter(
        station => station.city.toLowerCase().includes(city.toLowerCase())
      );
    }

    // Filter by state if provided
    if (state) {
      filteredStations = filteredStations.filter(
        station => station.state.toLowerCase().includes(state.toLowerCase())
      );
    }

    // Filter by network if provided
    if (network) {
      filteredStations = filteredStations.filter(
        station => station.network.toLowerCase().includes(network.toLowerCase())
      );
    }

    if (String(available_only).toLowerCase() === 'true') {
      filteredStations = filteredStations.filter(station => station.availability === 'available');
    }

    if (String(fast_charger_only).toLowerCase() === 'true') {
      filteredStations = filteredStations.filter(station => (station.power_kw || 0) >= 50);
    }

    if (min_power_kw != null && !isNaN(parseFloat(min_power_kw))) {
      filteredStations = filteredStations.filter(station => (station.power_kw || 0) >= parseFloat(min_power_kw));
    }

    // Attach ratings from DB reviews table
    const dbInstance = db.getDb();
    const stationIds = filteredStations.map(s => String(s.id));
    if (stationIds.length === 0) {
      return res.json({
        success: true,
        stations: [],
        total: 0,
        source: 'india_api'
      });
    }

    const placeholders = stationIds.map(() => '?').join(',');
    dbInstance.all(
      `SELECT station_id, ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as review_count
       FROM station_reviews
       WHERE station_id IN (${placeholders})
       GROUP BY station_id`,
      stationIds,
      (err, ratingRows) => {
        if (err) {
          return res.status(500).json({
            success: false,
            error: 'Failed to fetch station ratings',
            message: err.message
          });
        }

        const byId = {};
        (ratingRows || []).forEach(r => {
          byId[String(r.station_id)] = {
            avg_rating: r.avg_rating ? parseFloat(r.avg_rating) : null,
            review_count: r.review_count ? parseInt(r.review_count, 10) : 0
          };
        });

        const withRatings = filteredStations.map(st => ({
          ...st,
          avg_rating: byId[String(st.id)]?.avg_rating || null,
          review_count: byId[String(st.id)]?.review_count || 0
        }));

        res.json({
          success: true,
          stations: withRatings,
          total: withRatings.length,
          source: 'india_api'
        });
      }
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch India charging stations',
      message: error.message
    });
  }
});

// Get station by ID
router.get('/:id', (req, res) => {
  try {
    const station = sampleIndiaStations.find(s => s.id === req.params.id);

    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }

    res.json({
      success: true,
      station
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch station',
      message: error.message
    });
  }
});

// Search stations by location
router.get('/search/location', (req, res) => {
  try {
    const { lat, lng, radius = 50 } = req.query; // radius in km

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const radiusKm = parseFloat(radius);

    // Calculate distance using Haversine formula
    const stationsWithDistance = sampleIndiaStations.map(station => {
      if (!station.latitude || !station.longitude) {
        return { ...station, distance: null };
      }

      const R = 6371; // Earth's radius in km
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
      .filter(s => s.distance !== null && s.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    res.json({
      success: true,
      stations: nearbyStations,
      total: nearbyStations.length,
      location: { lat: userLat, lng: userLng },
      radius: radiusKm
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to search stations',
      message: error.message
    });
  }
});

// Get statistics about India stations
router.get('/stats/summary', (req, res) => {
  try {
    const networks = [...new Set(sampleIndiaStations.map(s => s.network))];
    const cities = [...new Set(sampleIndiaStations.map(s => s.city))];
    const states = [...new Set(sampleIndiaStations.map(s => s.state))];
    const totalPower = sampleIndiaStations.reduce((sum, s) => sum + s.power_kw, 0);
    const avgPower = totalPower / sampleIndiaStations.length;

    res.json({
      success: true,
      stats: {
        totalStations: sampleIndiaStations.length,
        totalNetworks: networks.length,
        networks: networks,
        cities: cities.length,
        states: states.length,
        totalPower: Math.round(totalPower),
        averagePower: Math.round(avgPower * 10) / 10
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

// Export both the router and the sample data
module.exports = { router, sampleIndiaStations };

