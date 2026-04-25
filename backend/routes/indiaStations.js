const express = require('express');
const db = require('../config/database');
const router = express.Router();

// Sample India charging stations data (Comprehensive dataset for Gujarat, Maharashtra, and North India)
const sampleIndiaStations = [
  // --- SURAT STATIONS ---
  {
    id: 'india-surat-1',
    name: 'Statiq Charging Station - Surat Central',
    address: 'Near Surat Railway Station, Varachha',
    city: 'Surat',
    state: 'Gujarat',
    latitude: 21.2049,
    longitude: 72.8411,
    connector_type: 'CCS2, Type 2',
    power_kw: 60,
    availability: 'available',
    network: 'Statiq',
    price_per_kw: 18
  },
  {
    id: 'india-surat-2',
    name: 'Tata Power EZ Charge - VR Mall',
    address: 'Dumas Road, Magdalla',
    city: 'Surat',
    state: 'Gujarat',
    latitude: 21.1445,
    longitude: 72.7489,
    connector_type: 'CCS2',
    power_kw: 50,
    availability: 'available',
    network: 'Tata Power',
    price_per_kw: 22
  },
  {
    id: 'india-surat-3',
    name: 'Jio-bp pulse - Adajan',
    address: 'Adajan Gam, Surat',
    city: 'Surat',
    state: 'Gujarat',
    latitude: 21.1959,
    longitude: 72.7933,
    connector_type: 'CCS2, DC-001',
    power_kw: 80,
    availability: 'available',
    network: 'Jio-bp',
    price_per_kw: 20
  },
  {
    id: 'india-surat-4',
    name: 'Fortum Charge & Drive - Piplod',
    address: 'Piplod Main Road',
    city: 'Surat',
    state: 'Gujarat',
    latitude: 21.1702,
    longitude: 72.7831,
    connector_type: 'CCS2',
    power_kw: 50,
    availability: 'available',
    network: 'Fortum',
    price_per_kw: 21
  },

  // --- VADODARA & BHARUCH (Between Surat and Ahmedabad) ---
  {
    id: 'india-bharuch-1',
    name: 'Statiq - Hotel Shalimar',
    address: 'NH-48, Bharuch Bypass',
    city: 'Bharuch',
    state: 'Gujarat',
    latitude: 21.7051,
    longitude: 72.9959,
    connector_type: 'CCS2',
    power_kw: 60,
    availability: 'available',
    network: 'Statiq',
    price_per_kw: 19
  },
  {
    id: 'india-vadodara-1',
    name: 'Tata Power - Inorbit Mall',
    address: 'Gorwa Road, Vadodara',
    city: 'Vadodara',
    state: 'Gujarat',
    latitude: 22.3211,
    longitude: 73.1652,
    connector_type: 'CCS2, Type 2',
    power_kw: 50,
    availability: 'available',
    network: 'Tata Power',
    price_per_kw: 20
  },
  {
    id: 'india-vadodara-2',
    name: 'Zeon Charging - Sayajigunj',
    address: 'Sayajigunj, Vadodara',
    city: 'Vadodara',
    state: 'Gujarat',
    latitude: 22.3106,
    longitude: 73.1811,
    connector_type: 'CCS2',
    power_kw: 120,
    availability: 'available',
    network: 'Zeon',
    price_per_kw: 24
  },

  // --- AHMEDABAD STATIONS ---
  {
    id: 'india-ahmedabad-1',
    name: 'Ather Grid - Ahmedabad One',
    address: 'Vastrapur, Ahmedabad',
    city: 'Ahmedabad',
    state: 'Gujarat',
    latitude: 23.0396,
    longitude: 72.5309,
    connector_type: 'Type 2, LEV',
    power_kw: 22,
    availability: 'available',
    network: 'Ather',
    price_per_kw: 15
  },
  {
    id: 'india-ahmedabad-2',
    name: 'Statiq - Iscon Cross Road',
    address: 'SG Highway, Ahmedabad',
    city: 'Ahmedabad',
    state: 'Gujarat',
    latitude: 23.0245,
    longitude: 72.5072,
    connector_type: 'CCS2',
    power_kw: 120,
    availability: 'available',
    network: 'Statiq',
    price_per_kw: 22
  },

  // --- MUMBAI STATIONS ---
  {
    id: 'india-mumbai-1',
    name: 'Tata Power - BKC Hub',
    address: 'Bandra Kurla Complex',
    city: 'Mumbai',
    state: 'Maharashtra',
    latitude: 19.0596,
    longitude: 72.8681,
    connector_type: 'CCS2, CHAdeMO',
    power_kw: 100,
    availability: 'available',
    network: 'Tata Power',
    price_per_kw: 25
  },
  {
    id: 'india-mumbai-2',
    name: 'Magenta ChargeGrid - Vashi',
    address: 'Sector 17, Vashi',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    latitude: 19.0745,
    longitude: 72.9978,
    connector_type: 'CCS2, Type 2',
    power_kw: 50,
    availability: 'available',
    network: 'Magenta',
    price_per_kw: 18
  },

  // --- DELHI & NCR ---
  {
    id: 'india-delhi-1',
    name: 'Statiq - Connaught Place',
    address: 'Radial Road, CP',
    city: 'New Delhi',
    state: 'Delhi',
    latitude: 28.6315,
    longitude: 77.2167,
    connector_type: 'CCS2',
    power_kw: 120,
    availability: 'available',
    network: 'Statiq',
    price_per_kw: 24
  },
  {
    id: 'india-delhi-2',
    name: 'Tata Power - Aerocity',
    address: 'Aerocity, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    latitude: 28.5511,
    longitude: 77.1211,
    connector_type: 'CCS2, Type 2',
    power_kw: 50,
    availability: 'available',
    network: 'Tata Power',
    price_per_kw: 22
  },

  // --- RAJASTHAN (Between Delhi and Gujarat) ---
  {
    id: 'india-jaipur-1',
    name: 'Statiq - Hotel Clarks Amer',
    address: 'JLN Marg, Jaipur',
    city: 'Jaipur',
    state: 'Rajasthan',
    latitude: 26.8505,
    longitude: 75.8050,
    connector_type: 'CCS2',
    power_kw: 60,
    availability: 'available',
    network: 'Statiq',
    price_per_kw: 20
  },
  {
    id: 'india-udaipur-1',
    name: 'Tata Power - Celebration Mall',
    address: 'Bhuwana, Udaipur',
    city: 'Udaipur',
    state: 'Rajasthan',
    latitude: 24.6152,
    longitude: 73.7088,
    connector_type: 'CCS2',
    power_kw: 50,
    availability: 'available',
    network: 'Tata Power',
    price_per_kw: 21
  }
];

// --- API Implementation ---

router.get('/', (req, res) => {
  try {
    const { city, state, network, available_only, fast_charger_only, min_power_kw } = req.query;
    let filteredStations = [...sampleIndiaStations];

    if (city) {
      filteredStations = filteredStations.filter(s => s.city.toLowerCase().includes(city.toLowerCase()));
    }
    if (state) {
      filteredStations = filteredStations.filter(s => s.state.toLowerCase().includes(state.toLowerCase()));
    }
    if (network) {
      filteredStations = filteredStations.filter(s => s.network.toLowerCase().includes(network.toLowerCase()));
    }
    if (String(available_only).toLowerCase() === 'true') {
      filteredStations = filteredStations.filter(s => s.availability === 'available');
    }
    if (String(fast_charger_only).toLowerCase() === 'true') {
      filteredStations = filteredStations.filter(s => (s.power_kw || 0) >= 50);
    }
    if (min_power_kw != null && !isNaN(parseFloat(min_power_kw))) {
      filteredStations = filteredStations.filter(s => (s.power_kw || 0) >= parseFloat(min_power_kw));
    }

    const dbInstance = db.getDb();
    const stationIds = filteredStations.map(s => String(s.id));
    
    if (stationIds.length === 0) {
      return res.json({ success: true, stations: [], total: 0, source: 'india_api' });
    }

    const placeholders = stationIds.map(() => '?').join(',');
    dbInstance.all(
      `SELECT station_id, ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as review_count
       FROM station_reviews
       WHERE station_id IN (${placeholders})
       GROUP BY station_id`,
      stationIds,
      (err, ratingRows) => {
        if (err) return res.status(500).json({ success: false, error: 'Rating fetch failed', message: err.message });

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

        res.json({ success: true, stations: withRatings, total: withRatings.length, source: 'india_api' });
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, error: 'API Error', message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const station = sampleIndiaStations.find(s => s.id === req.params.id);
    if (!station) return res.status(404).json({ success: false, error: 'Station not found' });
    res.json({ success: true, station });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error', message: error.message });
  }
});

router.get('/search/location', (req, res) => {
  try {
    const { lat, lng, radius = 50 } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, error: 'Coords required' });

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const radiusKm = parseFloat(radius);

    const stationsWithDistance = sampleIndiaStations.map(station => {
      if (!station.latitude || !station.longitude) return { ...station, distance: null };
      const R = 6371;
      const dLat = (station.latitude - userLat) * Math.PI / 180;
      const dLng = (station.longitude - userLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(userLat * Math.PI / 180) * Math.cos(station.latitude * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      return { ...station, distance: Math.round(distance * 10) / 10 };
    });

    const nearbyStations = stationsWithDistance.filter(s => s.distance !== null && s.distance <= radiusKm).sort((a, b) => a.distance - b.distance);

    res.json({ success: true, stations: nearbyStations, total: nearbyStations.length });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Search Error', message: error.message });
  }
});

module.exports = { router, sampleIndiaStations };
