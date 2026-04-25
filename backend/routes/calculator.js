const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const axios = require('axios');

const router = express.Router();

// Average EV efficiency (kWh per 100 km)
const AVERAGE_EFFICIENCY = 20; // kWh per 100 km
const DEFAULT_BATTERY_CAPACITY = 60; // kWh

const logUsageEvent = (userId, eventType, metadata = {}) => {
  try {
    const dbInstance = db.getDb();
    dbInstance.run(
      `INSERT INTO usage_events (user_id, event_type, metadata) VALUES (?, ?, ?)`,
      [userId || null, eventType, JSON.stringify(metadata || {})]
    );
  } catch (e) {
    // non-blocking analytics; ignore failures
  }
};

// Calculate battery range
router.post('/range', [
  body('batteryPercentage').isFloat({ min: 0, max: 100 }).withMessage('Battery percentage must be between 0 and 100'),
  body('batteryCapacity').optional().isFloat({ min: 0 }).withMessage('Battery capacity must be positive'),
  body('efficiency').optional().isFloat({ min: 0 }).withMessage('Efficiency must be positive')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { batteryPercentage, batteryCapacity = DEFAULT_BATTERY_CAPACITY, efficiency = AVERAGE_EFFICIENCY } = req.body;

    // Calculate available energy
    const availableEnergy = (batteryPercentage / 100) * batteryCapacity;

    // Calculate range in km
    const rangeKm = (availableEnergy / efficiency) * 100;

    res.json({
      batteryPercentage,
      batteryCapacity,
      efficiency,
      range: {
        kilometers: Math.round(rangeKm * 10) / 10
      },
      availableEnergy: Math.round(availableEnergy * 10) / 10
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Dynamic range prediction (viva-friendly "ML-ready" model)
router.post('/predict-range', [
  body('batteryPercentage').isFloat({ min: 0, max: 100 }).withMessage('Battery percentage must be between 0 and 100'),
  body('batteryCapacity').optional().isFloat({ min: 0 }).withMessage('Battery capacity must be positive'),
  body('efficiency').optional().isFloat({ min: 0 }).withMessage('Base efficiency (kWh per 100 km) must be positive'),
  body('speedKmph').optional().isFloat({ min: 5 }).withMessage('speedKmph must be >= 5'),
  body('trafficLevel').optional().isIn(['low', 'medium', 'high']).withMessage('trafficLevel must be low/medium/high'),
  body('drivingStyle').optional().isIn(['eco', 'normal', 'aggressive']).withMessage('drivingStyle must be eco/normal/aggressive')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      batteryPercentage,
      batteryCapacity = DEFAULT_BATTERY_CAPACITY,
      efficiency = AVERAGE_EFFICIENCY,
      speedKmph = 60,
      trafficLevel = 'medium',
      drivingStyle = 'normal'
    } = req.body;

    const availableEnergy = (batteryPercentage / 100) * batteryCapacity;

    const speedDelta = Math.max(0, speedKmph - 60);
    const speedFactor = Math.min(1.5, Math.max(0.85, 1 + (speedDelta / 100) * 0.35));

    const trafficFactor =
      trafficLevel === 'low' ? 1.0 :
      trafficLevel === 'high' ? 1.18 :
      1.08;

    const styleFactor =
      drivingStyle === 'eco' ? 0.9 :
      drivingStyle === 'aggressive' ? 1.18 :
      1.0;

    const adjustedEfficiency = efficiency * speedFactor * trafficFactor * styleFactor;
    const rangeKm = (availableEnergy / adjustedEfficiency) * 100;

    res.json({
      batteryPercentage,
      batteryCapacity,
      baseEfficiency: efficiency,
      adjustedEfficiency: Math.round(adjustedEfficiency * 10) / 10,
      inputs: { speedKmph, trafficLevel, drivingStyle },
      range: {
        kilometers: Math.round(rangeKm * 10) / 10
      },
      availableEnergy: Math.round(availableEnergy * 10) / 10
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Check route feasibility
router.post('/route-check', [
  body('distance').optional().isFloat({ min: 0 }).withMessage('Distance must be positive'),
  body('batteryPercentage').isFloat({ min: 0, max: 100 }).withMessage('Battery percentage must be between 0 and 100'),
  body('batteryCapacity').optional().isFloat({ min: 0 }).withMessage('Battery capacity must be positive'),
  body('efficiency').optional().isFloat({ min: 0 }).withMessage('Efficiency must be positive'),
  body('unit').optional().isIn(['km']).withMessage('Unit must be km'),
  body('origin').optional().notEmpty().withMessage('Origin location'),
  body('destination').optional().notEmpty().withMessage('Destination location')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      distance,
      batteryPercentage,
      batteryCapacity = DEFAULT_BATTERY_CAPACITY,
      efficiency = AVERAGE_EFFICIENCY,
      unit = 'km',
      origin,
      destination,
      originCoords,
      destCoords
    } = req.body;

    const haversineKm = (lat1, lon1, lat2, lon2) => {
      if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const fetchRouteGeometry = async (o, d) => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=full&geometries=geojson`;
        const res = await axios.get(url, { headers: { 'User-Agent': 'EV-Assistant-Backend' } });
        if (res.data?.routes?.[0]?.geometry?.coordinates) {
          return res.data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]); // [lat, lon]
        }
      } catch (e) { console.error('OSRM Fetch Error:', e.message); }
      return null;
    };

    let resolvedDistanceKm = null;
    if (distance != null && !isNaN(parseFloat(distance))) {
      resolvedDistanceKm = parseFloat(distance);
    } else if (
      originCoords && destCoords &&
      originCoords.lat != null && originCoords.lon != null &&
      destCoords.lat != null && destCoords.lon != null
    ) {
      resolvedDistanceKm = haversineKm(
        parseFloat(originCoords.lat), parseFloat(originCoords.lon),
        parseFloat(destCoords.lat),  parseFloat(destCoords.lon)
      );
    } else {
      return res.status(400).json({ error: 'Please provide either a distance or both origin and destination to calculate it.' });
    }

    const distanceKm = resolvedDistanceKm;
    const availableEnergyKwh = (batteryPercentage / 100) * batteryCapacity;
    const rangeKm    = availableEnergyKwh / (efficiency / 100);
    const maxRangeKm = batteryCapacity    / (efficiency / 100);

    const isReachable    = rangeKm >= distanceKm;
    const remainingRange = rangeKm - distanceKm;
    const shortfallKm    = isReachable ? 0 : distanceKm - rangeKm;
    const batteryNeededPct = Math.min(100, (distanceKm / maxRangeKm) * 100);
    const chargingStops  = isReachable ? 0 : Math.ceil(shortfallKm / (rangeKm > 0 ? rangeKm : maxRangeKm));

    let chargingStationsData = null;
    if (originCoords && destCoords) {
      try {
        const originLat = parseFloat(originCoords.lat);
        const originLon = parseFloat(originCoords.lon);
        const destLat   = parseFloat(destCoords.lat);
        const destLon   = parseFloat(destCoords.lon);

        const dbInstance = db.getDb();
        const dbStations = await new Promise((resolve, reject) => {
          dbInstance.all(
            `SELECT cs.*, u.username as owner_name
             FROM charging_stations cs
             LEFT JOIN users u ON cs.owner_id = u.id
             WHERE cs.is_verified = 1 AND cs.latitude IS NOT NULL AND cs.longitude IS NOT NULL`,
            (err, rows) => { if (err) reject(err); else resolve(rows || []); }
          );
        });

        const { sampleIndiaStations } = require('./indiaStations');
        const allPotentialStations = [
          ...dbStations.map(s => ({ ...s, source: 'verified' })),
          ...(sampleIndiaStations || []).map(s => ({
            ...s, source: 'india_api',
            status: s.availability === 'available' ? 'available' : 'offline',
            slots_total: 4, slots_available: s.availability === 'available' ? 2 : 0,
            expected_wait_minutes: 0
          }))
        ];

        const polyline = await fetchRouteGeometry(originCoords, destCoords);
        
        const ROUTE_BUFFER_KM = 10; // Strict mandatory limit

        const stationsWithDistance = allPotentialStations.map(station => {
          const sLat = parseFloat(station.latitude || station.lat);
          const sLon = parseFloat(station.longitude || station.lon || station.lng);
          if (isNaN(sLat) || isNaN(sLon)) return null;

          let minD = Infinity;
          if (polyline && polyline.length > 0) {
            // Check distance to route points (step of 10 for performance)
            const step = 10; 
            for (let i = 0; i < polyline.length; i += step) {
              const d = haversineKm(sLat, sLon, polyline[i][0], polyline[i][1]);
              if (d < minD) minD = d;
            }
            // Always check the very last point too
            const dLast = haversineKm(sLat, sLon, polyline[polyline.length-1][0], polyline[polyline.length-1][1]);
            if (dLast < minD) minD = dLast;
          } else {
            // Fallback to source/dest only if OSRM fails
            minD = Math.min(haversineKm(sLat, sLon, originLat, originLon), haversineKm(sLat, sLon, destLat, destLon));
          }

          return { ...station, distance: Math.round(minD * 10) / 10 };
        })
          .filter(s => s !== null && s.distance <= ROUTE_BUFFER_KM)
          .sort((a, b) => a.distance - b.distance);

        const count = stationsWithDistance.length;
        let warning = null;
        if (count === 0) {
          warning = { level: 'high', message: 'No charging stations found within the route corridor.', type: 'no-stations' };
        } else if (count <= 3 && distanceKm > 100) {
          warning = { level: 'low', message: `Only ${count} station(s) within ${Math.round(ROUTE_BUFFER_KM)} km of your route.`, type: 'few-stations' };
        }

        chargingStationsData = {
          count,
          routeBufferKm: Math.round(ROUTE_BUFFER_KM),
          warning,
          stations: stationsWithDistance.slice(0, 15)
        };
      } catch (stErr) {
        console.error('Error checking charging stations:', stErr);
      }
    }

    const response = {
      distance:       { kilometers: Math.round(distanceKm * 10) / 10 },
      currentRange:   { kilometers: Math.round(rangeKm * 10) / 10 },
      maxRange:       { kilometers: Math.round(maxRangeKm * 10) / 10 },
      isReachable,
      remainingRange: { kilometers: Math.round(remainingRange * 10) / 10 },
      shortfallKm:    Math.round(shortfallKm * 10) / 10,
      batteryNeeded:  isReachable ? 0 : Math.round(batteryNeededPct * 10) / 10,
      chargingStops,
      recommendation: isReachable
        ? `✔ Trip possible without charging. Arrives with ~${Math.round(remainingRange)} km to spare.`
        : `⚠ ${chargingStops} charging stop${chargingStops !== 1 ? 's' : ''} required. Shortfall: ${Math.round(shortfallKm)} km.`
    };

    if (chargingStationsData) response.chargingStations = chargingStationsData;
    res.json(response);
  } catch (error) {
    console.error('Route check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check destination reachability and find charging stations
router.post('/destination-check', [
  body('origin').notEmpty().withMessage('Origin is required'),
  body('destination').notEmpty().withMessage('Destination is required'),
  body('batteryPercentage').isFloat({ min: 0, max: 100 }).withMessage('Battery percentage must be between 0 and 100'),
  body('batteryCapacity').optional().isFloat({ min: 0 }).withMessage('Battery capacity must be positive'),
  body('efficiency').optional().isFloat({ min: 0 }).withMessage('Efficiency must be positive'),
  body('currentRange').isFloat({ min: 0 }).withMessage('Current range must be positive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      origin,
      destination,
      batteryPercentage,
      batteryCapacity = DEFAULT_BATTERY_CAPACITY,
      efficiency = AVERAGE_EFFICIENCY,
      currentRange,
      useCurrentLocation = false
    } = req.body;

    let originLat, originLng;
    if (useCurrentLocation && origin.includes(',')) {
      const coords = origin.split(',').map(c => parseFloat(c.trim()));
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        originLat = coords[0];
        originLng = coords[1];
      }
    }

    if (!originLat || !originLng) {
      try {
        const originResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(origin)}&limit=1`,
          { headers: { 'User-Agent': 'EV-Assistant-App/1.0 (contact@evassistant.com)' } }
        );
        const originData = await originResponse.json();
        if (!originData || originData.length === 0) {
          return res.status(400).json({ error: 'Origin address not found.' });
        }
        originLat = parseFloat(originData[0].lat);
        originLng = parseFloat(originData[0].lon);
      } catch (err) {
        return res.status(400).json({ error: 'Error geocoding origin address.' });
      }
    }

    let destLat, destLng;
    try {
      const destResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=1`,
        { headers: { 'User-Agent': 'EV-Assistant-App/1.0 (contact@evassistant.com)' } }
      );
      const destData = await destResponse.json();
      if (!destData || destData.length === 0) {
        return res.status(400).json({ error: 'Destination address not found.' });
      }
      destLat = parseFloat(destData[0].lat);
      destLng = parseFloat(destData[0].lon);
    } catch (err) {
      return res.status(400).json({ error: 'Error geocoding destination address.' });
    }

    const R = 6371;
    const dLat = (destLat - originLat) * Math.PI / 180;
    const dLng = (destLng - originLng) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(originLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    const isReachable = currentRange >= distanceKm;
    const remainingRange = currentRange - distanceKm;
    const batteryNeeded = isReachable ? 0 : ((distanceKm - currentRange) * (efficiency / 100)) / batteryCapacity * 100;

    let chargingStations = [];
    if (!isReachable) {
      try {
        const dbInstance = db.getDb();
        dbInstance.all(
          `SELECT cs.*, u.username as owner_name FROM charging_stations cs JOIN users u ON cs.owner_id = u.id WHERE cs.is_verified = 1 AND cs.latitude IS NOT NULL AND cs.longitude IS NOT NULL`,
          async (err, verifiedStations) => {
            if (err) {
              console.error('Error fetching stations:', err);
            } else {
              const { sampleIndiaStations } = require('./indiaStations');
              const allPotentialStations = [
                ...(verifiedStations || []).map(s => ({ ...s, source: 'verified' })),
                ...(sampleIndiaStations || []).map(s => ({
                  ...s, source: 'india_api', status: s.availability === 'available' ? 'available' : 'offline', slots_total: 4, slots_available: 2, expected_wait_minutes: 0
                }))
              ];
              const midLat = (originLat + destLat) / 2;
              const midLng = (originLng + destLng) / 2;

              const stationsWithDistance = allPotentialStations.map(station => {
                const sLat = parseFloat(station.latitude || station.lat);
                const sLng = parseFloat(station.longitude || station.lon || station.lng);
                if (isNaN(sLat) || isNaN(sLng)) return null;
                const getDist = (lat1, lon1, lat2, lon2) => {
                  const dLat = (lat2 - lat1) * Math.PI / 180;
                  const dLon = (lon2 - lon1) * Math.PI / 180;
                  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
                  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                };
                const minDistance = Math.min(getDist(sLat, sLng, originLat, originLng), getDist(sLat, sLng, destLat, destLng), getDist(sLat, sLng, midLat, midLng));
                return { ...station, distance: Math.round(minDistance * 10) / 10 };
              }).filter(s => s !== null && s.distance <= 250).sort((a, b) => a.distance - b.distance);
              chargingStations = stationsWithDistance.slice(0, 10);
            }
            res.json({
              distance: { kilometers: Math.round(distanceKm * 10) / 10 },
              currentRange: { kilometers: Math.round(currentRange * 10) / 10 },
              isReachable,
              remainingRange: { kilometers: Math.round(remainingRange * 10) / 10 },
              recommendation: isReachable ? 'Reachable' : `Charging Required`,
              batteryNeeded: isReachable ? 0 : Math.round(batteryNeeded * 10) / 10,
              chargingStations
            });
          }
        );
      } catch (err) {
        res.json({ distance: { kilometers: Math.round(distanceKm * 10) / 10 }, currentRange: { kilometers: Math.round(currentRange * 10) / 10 }, isReachable, remainingRange: { kilometers: Math.round(remainingRange * 10) / 10 }, batteryNeeded: 0, chargingStations: [] });
      }
    } else {
      res.json({ distance: { kilometers: Math.round(distanceKm * 10) / 10 }, currentRange: { kilometers: Math.round(currentRange * 10) / 10 }, isReachable, remainingRange: { kilometers: Math.round(remainingRange * 10) / 10 }, recommendation: 'Reachable', batteryNeeded: 0, chargingStations: [] });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Optimize an EV trip
router.post('/optimize-route', [
  body('originCoords').exists().withMessage('originCoords is required'),
  body('destCoords').exists().withMessage('destCoords is required'),
  body('batteryPercentage').isFloat({ min: 0, max: 100 }).withMessage('Battery percentage must be between 0 and 100'),
  body('batteryCapacity').optional().isFloat({ min: 0 }).withMessage('Battery capacity must be positive'),
  body('efficiency').optional().isFloat({ min: 0 }).withMessage('Efficiency must be positive'),
  body('avgSpeedKmph').optional().isFloat({ min: 5 }).withMessage('avgSpeedKmph must be >= 5'),
  body('optimizeFor').optional().isIn(['min_stops', 'min_time']).withMessage('optimizeFor must be min_stops or min_time'),
  body('maxStationsToConsider').optional().isInt({ min: 3, max: 30 }).withMessage('maxStationsToConsider must be between 3 and 30'),
  body('filters').optional().isObject().withMessage('filters must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { originCoords, destCoords, batteryPercentage, batteryCapacity = DEFAULT_BATTERY_CAPACITY, efficiency = AVERAGE_EFFICIENCY, avgSpeedKmph = 80, optimizeFor = 'min_stops', maxStationsToConsider = 15, filters = {} } = req.body;

    const originLat = parseFloat(originCoords.lat);
    const originLon = parseFloat(originCoords.lon);
    const destLat = parseFloat(destCoords.lat);
    const destLon = parseFloat(destCoords.lon);

    const haversineKm = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const initialRangeKm = ((batteryPercentage / 100) * batteryCapacity / efficiency) * 100;
    const fullRangeKm = (batteryCapacity / efficiency) * 100;

    const dbInstance = db.getDb();
    const verifiedStations = await new Promise((resolve, reject) => {
      dbInstance.all(`SELECT cs.* FROM charging_stations cs WHERE cs.is_verified = 1 AND cs.latitude IS NOT NULL AND cs.longitude IS NOT NULL`, (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });

    const { sampleIndiaStations } = require('./indiaStations');
    const indiaStations = (sampleIndiaStations || []).map(s => ({
      ...s, latitude: s.latitude ?? s.lat ?? null, longitude: s.longitude ?? s.lon ?? s.lng ?? null,
      status: s.availability === 'available' ? 'available' : 'offline', slots_total: 4, slots_available: 2, expected_wait_minutes: 0, source: 'india_api'
    }));

    // Fetch road-accurate geometry and metrics
    const routeData = await (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=full&geometries=geojson`;
        const r = await axios.get(url, { headers: { 'User-Agent': 'EV-Assistant-Backend' } });
        return {
          polyline: r.data?.routes?.[0]?.geometry?.coordinates?.map(c => [c[1], c[0]]) || null,
          distanceKm: (r.data?.routes?.[0]?.distance || 0) / 1000,
          durationMin: (r.data?.routes?.[0]?.duration || 0) / 60
        };
      } catch { return null; }
    })();

    const polyline = routeData?.polyline;
    const totalDistanceKm = routeData?.distanceKm || 0;

    // 1. Get BBox from polyline to optimize search
    const getBBox = (path, padding = 0.1) => {
      let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
      path.forEach(([lat, lon]) => {
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
      });
      return { minLat: minLat - padding, maxLat: maxLat + padding, minLon: minLon - padding, maxLon: maxLon + padding };
    };

    const bbox = polyline ? getBBox(polyline, 0.08) : null;

    // 2. Filter stations using BBox if available
    const allPotentialStations = [
      ...verifiedStations.map(s => ({
        ...s, latitude: s.latitude ?? s.lat ?? null, longitude: s.longitude ?? s.lon ?? s.lng ?? null,
        status: s.status || (s.availability === 'available' ? 'available' : 'offline'), slots_total: s.slots_total || 4, slots_available: s.slots_available ?? 4, expected_wait_minutes: 0, source: 'verified'
      })),
      ...indiaStations
    ].filter(s => {
      const lat = parseFloat(s.latitude);
      const lon = parseFloat(s.longitude);
      if (isNaN(lat) || isNaN(lon)) return false;
      if (bbox) {
        return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
      }
      return true;
    });

    const stationsWithProximity = allPotentialStations.map(station => {
      const sLat = parseFloat(station.latitude);
      const sLon = parseFloat(station.longitude);

      let minProximity = Infinity;
      if (polyline && polyline.length > 0) {
        // High-precision corridor check: sample the route to ensure coverage
        const step = polyline.length > 500 ? 15 : 5; 
        for (let i = 0; i < polyline.length; i += step) {
          const d = haversineKm(sLat, sLon, polyline[i][0], polyline[i][1]);
          if (d < minProximity) minProximity = d;
          if (minProximity < 0.5) break; // Optimization: If very close, stop checking
        }
        const dLast = haversineKm(sLat, sLon, polyline[polyline.length-1][0], polyline[polyline.length-1][1]);
        if (dLast < minProximity) minProximity = dLast;
      } else {
        // Fallback for direct point-to-point if routing fails
        const d1 = haversineKm(sLat, sLon, originLat, originLon);
        const d2 = haversineKm(sLat, sLon, destLat, destLon);
        minProximity = Math.min(d1, d2);
      }
      return { ...station, proximityKm: minProximity };
    }).filter(Boolean).filter(s => {
      if (s.proximityKm > 5) return false; // STRICT 5km buffer for highway stations
      if (filters.availableOnly && String(s.status || 'available') !== 'available') return false;
      if (filters.fastChargerOnly && Number(s.power_kw || 0) < 30) return false; 
      if (filters.minPowerKw != null && Number(s.power_kw || 0) < parseFloat(filters.minPowerKw)) return false;
      return true;
    }).sort((a, b) => a.proximityKm - b.proximityKm)
    .slice(0, 100);

    // WARNING: No stations found in corridor
    if (stationsWithProximity.length === 0) {
      return res.json({ 
        optimized: false, 
        warning: 'No charging stations were found along this route segment.',
        error: 'Incomplete station coverage.',
        totalStops: 0, stops: [], legs: [],
        potentialStations: []
      });
    }

    const stationIdKeys = stationsWithProximity.map(s => String(s.id));
    const ratingMap = {};
    if (stationIdKeys.length > 0) {
      const placeholders = stationIdKeys.map(() => '?').join(',');
      const ratingRows = await new Promise((resolve) => {
        dbInstance.all(`SELECT station_id, ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as review_count FROM station_reviews WHERE station_id IN (${placeholders}) GROUP BY station_id`, stationIdKeys, (err, rows) => resolve(rows || []));
      });
      ratingRows.forEach(r => { ratingMap[String(r.station_id)] = { avg_rating: r.avg_rating, review_count: r.review_count }; });
    }

    // ── PROJECT NODES ONTO POLYLINE ──────────────────────────
    const distToSegment = (px, py, x1, y1, x2, y2) => {
      const l2 = (x2-x1)**2 + (y2-y1)**2;
      if (l2 === 0) return haversineKm(px, py, x1, y1);
      let t = ((px-x1)*(x2-x1) + (py-y1)*(y2-y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      return haversineKm(px, py, x1 + t*(x2-x1), y1 + t*(y2-y1));
    };

    const projectToPolyline = (lat, lon, routePolyline) => {
      if (!routePolyline) return 0;
      let minDist = Infinity;
      let totalDist = 0;
      let bestDistAlong = 0;
      for (let i = 0; i < routePolyline.length - 1; i++) {
        const p1 = routePolyline[i], p2 = routePolyline[i+1];
        const segLen = haversineKm(p1[0], p1[1], p2[0], p2[1]);
        const d = distToSegment(lat, lon, p1[0], p1[1], p2[0], p2[1]);
        if (d < minDist) { minDist = d; bestDistAlong = totalDist + (segLen / 2); }
        totalDist += segLen;
      }
      return bestDistAlong;
    };

    const nodes = [
      { key: 'origin', type: 'origin', lat: originLat, lon: originLon, roadPos: 0 },
      ...stationsWithProximity.map(s => ({ 
        key: `station_${s.id}`, 
        type: 'station', 
        station: s, 
        lat: parseFloat(s.latitude), 
        lon: parseFloat(s.longitude),
        roadPos: projectToPolyline(parseFloat(s.latitude), parseFloat(s.longitude), polyline)
      })),
      { key: 'destination', type: 'destination', lat: destLat, lon: destLon, roadPos: totalDistanceKm }
    ];

    const originIndex = 0;
    const destinationIndex = nodes.length - 1;
    const stopWeight = optimizeFor === 'min_stops' ? 10000 : 30;

    const dist = new Array(nodes.length).fill(Number.POSITIVE_INFINITY);
    const prev = new Array(nodes.length).fill(null);
    const visited = new Array(nodes.length).fill(false);
    dist[originIndex] = 0;

    const edgeCost = (fromIdx, toIdx) => {
      const fromNode = nodes[fromIdx], toNode = nodes[toIdx];
      if (toNode.roadPos <= fromNode.roadPos) return null;
      const distanceKm = toNode.roadPos - fromNode.roadPos;
      
      if (fromNode.type === 'origin') { if (distanceKm > initialRangeKm) return null; }
      else if (fromNode.type === 'station') { if (distanceKm > fullRangeKm) return null; if (fromNode.station.status === 'offline') return null; }
      else return null;

      const travelTimeMinutes = (distanceKm / avgSpeedKmph) * 60;
      let waitTime = 0, chargeTime = 0, stopCost = 0;
      if (fromNode.type === 'station') {
        stopCost = 1; waitTime = Number(fromNode.station.expected_wait_minutes || 0);
        const powerRequested = Number(fromNode.station.power_kw || 0) || 50;
        chargeTime = ((distanceKm * efficiency) / 100 / powerRequested) * 60;
      }
      return { distanceKm, travelTimeMinutes, waitTime, chargeTime, stopCost, totalCost: stopCost * stopWeight + travelTimeMinutes + waitTime + chargeTime };
    };

    for (let iter = 0; iter < nodes.length; iter++) {
      let u = -1, best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < nodes.length; i++) { if (!visited[i] && dist[i] < best) { best = dist[i]; u = i; } }
      if (u === -1 || u === destinationIndex) break;
      visited[u] = true;
      for (let v = 0; v < nodes.length; v++) {
        if (visited[v] || v === u || nodes[u].type === 'destination') continue;
        const edge = edgeCost(u, v); if (!edge) continue;
        const alt = dist[u] + edge.totalCost; if (alt < dist[v]) { dist[v] = alt; prev[v] = u; }
      }
    }

    if (dist[destinationIndex] === Number.POSITIVE_INFINITY) {
      // Find farthest reachable station for suggestion
      let recommendedStation = null;
      let maxDistFromStart = -1;
      
      nodes.filter(n => n.type === 'station').forEach(node => {
        const dFromStart = node.roadPos;
        const st = node.station;
        
        if (dFromStart <= initialRangeKm && dFromStart > maxDistFromStart) {
          maxDistFromStart = dFromStart;
          recommendedStation = {
            id: st.id, 
            name: st.name, 
            city: st.city || 'Highway / Nearby City',
            distance: Math.round(dFromStart * 10) / 10,
            from: originCoords.label || 'Origin',
            to: destCoords.label || 'Destination',
            lat: node.lat, 
            lng: node.lon,
            power_kw: st.power_kw, 
            status: st.status, 
            source: st.source
          };
        }
      });

      return res.json({ 
        optimized: false, 
        error: 'No complete route found with current range.', 
        totalStops: 0, stops: [], legs: [],
        potentialStations: stationsWithProximity.slice(0, 40),
        recommendedStation
      });
    }

    const pathKeys = []; let cur = destinationIndex; while (cur != null) { pathKeys.unshift(cur); cur = prev[cur]; }
    const legs = [], stopList = [];
    for (let i = 0; i < pathKeys.length - 1; i++) {
      const fromIdx = pathKeys[i], toIdx = pathKeys[i+1], fromNode = nodes[fromIdx], toNode = nodes[toIdx], edge = edgeCost(fromIdx, toIdx);
      legs.push({ from: fromNode.type, to: toNode.type, fromStationId: fromNode.type === 'station' ? fromNode.station.id : null, toStationId: toNode.type === 'station' ? toNode.station.id : null, distanceKm: Math.round(edge.distanceKm * 10) / 10, totalLegTimeMinutes: Math.round((edge.travelTimeMinutes + edge.waitTime + edge.chargeTime) * 10) / 10 });
      if (fromNode.type === 'station') stopList.push(fromNode.station);
    }

    logUsageEvent(req.user?.id, 'optimize_route', {
      origin: originCoords.label || 'coords',
      destination: destCoords.label || 'coords',
      optimizeFor,
      totalStops: stopList.length,
      totalDistanceKm: Math.round(legs.reduce((s, l) => s + l.distanceKm, 0) * 10) / 10
    });

    res.json({
      optimized: true, 
      totalStops: stopList.length, 
      totalDistanceKm: Math.round(legs.reduce((s, l) => s + l.distanceKm, 0) * 10) / 10, 
      totalTimeMinutes: Math.round(legs.reduce((s, l) => s + l.totalLegTimeMinutes, 0) * 10) / 10,
      legs, 
      stops: stopList.map(st => ({ id: st.id, name: st.name, latitude: st.latitude, longitude: st.longitude, power_kw: st.power_kw, status: st.status, source: st.source })),
      allStationsInCorridor: stationsWithProximity.map(st => ({
        id: st.id, name: st.name, latitude: st.latitude, longitude: st.longitude, 
        power_kw: st.power_kw, status: st.status, source: st.source, distance: st.proximityKm
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Multi-stop trip planner
router.post('/multi-stop-plan', [
  body('points').isArray({ min: 2, max: 5 }).withMessage('points must contain 2 to 5 points'),
  body('batteryPercentage').isFloat({ min: 0, max: 100 }),
  body('batteryCapacity').optional().isFloat({ min: 0 }),
  body('efficiency').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const { points, batteryPercentage, batteryCapacity = DEFAULT_BATTERY_CAPACITY, efficiency = AVERAGE_EFFICIENCY, avgSpeedKmph = 80, optimizeFor = 'min_stops', maxStationsToConsider = 20, filters = {} } = req.body;
    const plans = [];
    let totalStops = 0, totalDistanceKm = 0, totalTimeMinutes = 0, currentBatt = batteryPercentage;
    const apiBase = `http://127.0.0.1:${process.env.PORT || 5000}`;

    // Helper to get raw OSRM metrics for fallback
    const getRawRouteMetrics = async (p1, p2) => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${p1.lon},${p1.lat};${p2.lon},${p2.lat}?overview=false`;
        const r = await axios.get(url, { headers: { 'User-Agent': 'EV-Assistant-Backend' } });
        if (r.data?.routes?.[0]) {
          return {
            distanceKm: r.data.routes[0].distance / 1000,
            durationMin: r.data.routes[0].duration / 60
          };
        }
      } catch {}
      return { distanceKm: 0, durationMin: 0 };
    };

    let fallbackTotalDistanceKm = 0;
    let fallbackTotalTimeMinutes = 0;
    const allLegMetrics = [];

    for (let i = 0; i < points.length - 1; i++) {
        const metrics = await getRawRouteMetrics(points[i], points[i+1]);
        fallbackTotalDistanceKm += metrics.distanceKm;
        fallbackTotalTimeMinutes += metrics.durationMin;
        allLegMetrics.push({
          index: i + 1,
          from: points[i],
          to: points[i+1],
          distanceKm: metrics.distanceKm,
          durationMin: metrics.durationMin
        });
    }

    for (let i = 0; i < points.length - 1; i++) {
      const body = { originCoords: points[i], destCoords: points[i + 1], batteryPercentage: currentBatt, batteryCapacity, efficiency, avgSpeedKmph, optimizeFor, maxStationsToConsider, filters };
      let segmentResponse = await fetch(`${apiBase}/api/calculator/optimize-route`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      let segmentResult = await segmentResponse.json();

      if (!segmentResult?.optimized) {
         return res.json({ 
            planned: false, 
            error: segmentResult.warning || segmentResult.error || `No feasible route for leg ${i + 1}`,
            legIndex: i + 1,
            points,
            legs: plans,
            allLegs: allLegMetrics,
            totalDistanceKm: Math.round(fallbackTotalDistanceKm * 10) / 10,
            totalTimeMinutes: Math.round(fallbackTotalTimeMinutes * 10) / 10,
            potentialStations: segmentResult.potentialStations || []
         });
      }

      plans.push({ legIndex: i + 1, from: points[i], to: points[i + 1], ...segmentResult });
      totalStops += segmentResult.totalStops; totalDistanceKm += segmentResult.totalDistanceKm; totalTimeMinutes += segmentResult.totalTimeMinutes;
      
      const lastLeg = segmentResult.legs[segmentResult.legs.length - 1];
      const usedPct = ((lastLeg.distanceKm * efficiency) / 100 / batteryCapacity) * 100;
      currentBatt = segmentResult.legs.length === 1 ? Math.max(0, body.batteryPercentage - usedPct) : Math.max(0, 100 - usedPct);
    }

    const allStationsInCorridorGroup = plans.flatMap(p => p.allStationsInCorridor || []);
    const uniqueStations = Array.from(new Map(allStationsInCorridorGroup.map(s => [s.id, s])).values());

    logUsageEvent(req.user?.id, 'multi_stop_plan', {
      points: points.length,
      totalStops,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10
    });

    res.json({ 
      planned: true, points, legs: plans, totalStops, 
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10, 
      totalTimeMinutes: Math.round(totalTimeMinutes * 10) / 10,
      allStationsInCorridor: uniqueStations
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
