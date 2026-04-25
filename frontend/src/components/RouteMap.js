import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import BookingModal from './BookingModal';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const getStatusColor = (status) => {
    if (status === 'available') return '#22c55e';
    if (status === 'busy') return '#f59e0b';
    if (status === 'offline') return '#6b7280';
    return '#f59e0b';
};

function ClickToBook({ stations, setSelectedStationForBooking }) {
    const map = useMap();

    useMapEvents({
        click(e) {
            const { lat, lng } = e.latlng;
            // Find nearest station from current route stations
            if (!stations || stations.length === 0) return;

            let nearest = null;
            let minDistance = Infinity;

            const calculateDistance = (lat1, lon1, lat2, lon2) => {
                const R = 6371;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            };

            stations.forEach(s => {
                const d = calculateDistance(lat, lng, parseFloat(s.latitude), parseFloat(s.longitude));
                if (d < minDistance) {
                    minDistance = d;
                    nearest = s;
                }
            });

            if (nearest && minDistance < 50) { // Limit to 50km
                 // We don't open the modal immediately to avoid annoying clicks.
                 // instead we'll allow popups to handle it.
                 // But wait, the user said "add booking in this when use click on any point".
                 // I'll open the modal for the nearest station.
                 setSelectedStationForBooking(nearest);
            }
        }
    });
    return null;
}

// Icon factory for charging stops (supports status-based markers)
const createStopIcon = (index, status, isPlannedStop) =>
    L.divIcon({
        html: `<div style="background-color: ${getStatusColor(status)}; 
                    width: ${isPlannedStop ? '36px' : '28px'}; 
                    height: ${isPlannedStop ? '36px' : '28px'}; 
                    border-radius: 50%; 
                    display: flex; align-items: center; justify-content: center; 
                    border: ${isPlannedStop ? '3px solid #fbbf24' : '2px solid white'}; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4); 
                    transition: all 0.3s ease;
                    position: relative;">
            <div style="font-size: ${isPlannedStop ? '20px' : '16px'}; line-height: 1;">⚡</div>
            ${isPlannedStop ? `<div style="position: absolute; top: -8px; right: -8px; background: #fbbf24; color: #000; font-size: 10px; padding: 2px 4px; border-radius: 4px; font-weight: bold; border: 1px solid white;">Stop</div>` : ''}
        </div>`,
        className: '',
        iconSize: [isPlannedStop ? 36 : 28, isPlannedStop ? 36 : 28],
        iconAnchor: [isPlannedStop ? 18 : 14, isPlannedStop ? 18 : 14]
    });

function FitBounds({ coords }) {
    const map = useMap();
    useEffect(() => {
        if (coords && coords.length >= 2) {
            const bounds = L.latLngBounds(coords);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [coords, map]);
    return null;
}

const RouteMap = ({ originCoords, destCoords, distance, stations = [], useStationsAsWaypoints = false, pathCoordinates = null, waypoints = [], currentRange = Infinity, isDefaultReachable = undefined }) => {
    const { getToken, isAuthenticated } = useAuth();
    const [selectedStationForBooking, setSelectedStationForBooking] = useState(null);
    const [mainRoute, setMainRoute] = useState(null);
    const [altRoutes, setAltRoutes] = useState([]);
    const [loading, setLoading] = useState(false);

    // Debug log to confirm stations arrived on frontend
    useEffect(() => {
        console.log(`RouteMap: Received ${stations.length} charging stations.`);
    }, [stations]);

    const pathCoordinatesString = JSON.stringify(pathCoordinates);
    
    useEffect(() => {
        if (originCoords && destCoords) {
            fetchRoute();
        }
        // Include stations and pathCoordinatesString in dependencies so optimized legs redraw correctly without reference-based infinite loops
    }, [originCoords, destCoords, stations, pathCoordinatesString, currentRange, isDefaultReachable]);

    const fetchLegRoute = async (from, to) => {
        const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            return {
                coords: data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]),
                distanceKm: data.routes[0].distance / 1000
            };
        }
        return {
            coords: [[from.lat, from.lon], [to.lat, to.lon]],
            distanceKm: 0
        };
    };

    const fetchRoute = async () => {
        setLoading(true);
        try {
            // Default mode: draw OSRM route origin -> destination, with charging stations as markers only.
            const hasPath = pathCoordinates && pathCoordinates.length >= 2;
            const hasStations = stations && stations.length > 0;
            if (!useStationsAsWaypoints || (!hasPath && !hasStations)) {
                // If waypoints are provided, use them to draw the full path (even if incomplete)
                let coordString = `${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}`;
                if (waypoints && waypoints.length > 2) {
                    coordString = waypoints.map(wp => `${wp.lon},${wp.lat}`).join(';');
                }

                const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson&alternatives=3`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.routes && data.routes.length > 0) {
                    const processRoute = (r, isMain = false) => {
                        const coords = r.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                        const dKm = r.distance / 1000;
                        
                        let reachable = dKm <= currentRange;
                        // Only force match parent the UI banner if it's the primary route, 
                        // so vastly longer alternate routes remain accurately unreachable.
                        if (isMain && isDefaultReachable !== undefined) {
                            reachable = isDefaultReachable;
                        }
                        
                        return { coords, distanceKm: dKm, isReachable: reachable };
                    };
                    
                    setMainRoute(processRoute(data.routes[0], true));
                    
                    let alts = [];
                    if (data.routes.length > 1) {
                        alts = data.routes.slice(1).map(processRoute);
                    }

                    // Simulated Alternative Routes if OSRM doesn't return them
                    if (alts.length === 0 && !hasPath && (!waypoints || waypoints.length <= 2)) {
                        try {
                            const dx = destCoords.lon - originCoords.lon;
                            const dy = destCoords.lat - originCoords.lat;
                            const midX = originCoords.lon + dx / 2;
                            const midY = originCoords.lat + dy / 2;

                            const offset1 = 0.12; 
                            const offset2 = 0.08; 

                            const p1Lon = midX - dy * offset1;
                            const p1Lat = midY + dx * offset1;
                            
                            const p2Lon = midX + dy * offset2;
                            const p2Lat = midY - dx * offset2;

                            const alt1Url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${p1Lon},${p1Lat};${destCoords.lon},${destCoords.lat}?overview=full&geometries=geojson`;
                            const alt2Url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${p2Lon},${p2Lat};${destCoords.lon},${destCoords.lat}?overview=full&geometries=geojson`;

                            const [res1, res2] = await Promise.all([fetch(alt1Url), fetch(alt2Url)]);
                            const data1 = await res1.json();
                            const data2 = await res2.json();

                            if (data1.routes && data1.routes.length > 0) alts.push(processRoute(data1.routes[0]));
                            if (data2.routes && data2.routes.length > 0) alts.push(processRoute(data2.routes[0]));
                        } catch (e) {
                            console.error("Alternative route sim failed", e);
                        }
                    }

                    setAltRoutes(alts);
                } else {
                    const fallback = { coords: [[originCoords.lat, originCoords.lon], [destCoords.lat, destCoords.lon]], distanceKm: 0, isReachable: isDefaultReachable !== undefined ? isDefaultReachable : true };
                    setMainRoute(fallback);
                    setAltRoutes([]);
                }
                return;
            }

            // Waypoint mode: treat stations as ordered charging stops and draw multi-leg OSRM polyline.
            let points = [];
            if (pathCoordinates && pathCoordinates.length >= 2) {
                points = pathCoordinates;
            } else {
                const orderedStops = (stations || []).filter(s => s && s.latitude != null && s.longitude != null);
                points = [
                    { lat: originCoords.lat, lon: originCoords.lon },
                    ...orderedStops.map(s => ({ lat: parseFloat(s.latitude), lon: parseFloat(s.longitude) })),
                    { lat: destCoords.lat, lon: destCoords.lon }
                ];
            }

            const combined = [];
            let totalD = 0;
            for (let i = 0; i < points.length - 1; i++) {
                const segmentData = await fetchLegRoute(points[i], points[i + 1]);
                if (combined.length > 0) combined.push(...segmentData.coords.slice(1));
                else combined.push(...segmentData.coords);
                totalD += segmentData.distanceKm;
            }
            setMainRoute({ coords: combined, distanceKm: totalD, isReachable: isDefaultReachable !== undefined ? isDefaultReachable : (totalD <= currentRange) });
            setAltRoutes([]);
        } catch (error) {
            console.error("OSRM Route Error:", error);
            const fallback = { coords: [[originCoords.lat, originCoords.lon], [destCoords.lat, destCoords.lon]], distanceKm: 0, isReachable: true };
            setMainRoute(fallback);
            setAltRoutes([]);
        } finally {
            setLoading(false);
        }
    };

    if (!originCoords || !destCoords) return null;

    const bounds = [
        [originCoords.lat, originCoords.lon],
        [destCoords.lat, destCoords.lon],
        ...stations.map(s => [parseFloat(s.latitude), parseFloat(s.longitude)]),
        ...waypoints.map(w => [parseFloat(w.lat), parseFloat(w.lon)])
    ];

    // Get intermediate waypoints (excluding start and end)
    const intermediateWaypoints = waypoints.slice(1, -1);

    return (
        <div className="route-map-wrapper" style={{
            marginTop: '2rem',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)'
        }}>
            <div style={{
                padding: '1rem',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h4 style={{ margin: 0 }}>📍 Real-Time Trip Route</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                        {loading ? 'Calculating Route...' : `Estimated: ${distance} km`}
                    </span>
                </div>
            </div>

            <MapContainer
                center={[originCoords.lat, originCoords.lon]}
                zoom={13}
                style={{ height: '450px', width: '100%' }}
                scrollWheelZoom={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <ClickToBook stations={stations} setSelectedStationForBooking={setSelectedStationForBooking} />

                {/* Origin Marker */}
                <Marker position={[originCoords.lat, originCoords.lon]}>
                    <Popup>🟢 **Start:** {originCoords.lat.toFixed(2)}, {originCoords.lon.toFixed(2)}</Popup>
                </Marker>

                {/* Destination Marker */}
                <Marker position={[destCoords.lat, destCoords.lon]}>
                    <Popup>🔴 **End:** {destCoords.lat.toFixed(2)}, {destCoords.lon.toFixed(2)}</Popup>
                </Marker>

                {/* Intermediate Waypoints */}
                {intermediateWaypoints.map((wp, idx) => (
                    <Marker key={`wp-${idx}`} position={[wp.lat, wp.lon]} icon={L.divIcon({
                        html: `<div style="background-color: #3b82f6; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                            <div style="color: white; font-weight: 700; font-size: 10px;">${idx + 1}</div>
                        </div>`,
                        className: '',
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    })}>
                        <Popup>📍 **Waypoint:** {wp.label || `${wp.lat.toFixed(2)}, ${wp.lon.toFixed(2)}`}</Popup>
                    </Marker>
                ))}

                {/* Alternative Routes */}
                {altRoutes
                  .filter(alt => mainRoute?.isReachable ? alt.isReachable : true)
                  .map((alt, idx) => (
                    <Polyline 
                        key={`alt-${idx}-${alt.isReachable}`} 
                        positions={alt.coords} 
                        pathOptions={{
                            color: alt.isReachable ? "#22c55e" : "#ef4444",
                            weight: 4,
                            opacity: 0.5,
                            lineJoin: "round"
                        }}
                        eventHandlers={{
                            click: () => {
                                const newMain = alt;
                                const newAlts = [...altRoutes];
                                newAlts[idx] = mainRoute;
                                setMainRoute(newMain);
                                setAltRoutes(newAlts);
                            }
                        }}
                    >
                        <Popup>
                            <b>{alt.isReachable ? "🟢 Reachable" : "🔴 Not Reachable"}</b><br/>
                            Distance: {alt.distanceKm.toFixed(1)} km
                            <br/><br/><i>Click to select this route</i>
                        </Popup>
                    </Polyline>
                ))}

                {/* Main Route */}
                {mainRoute && mainRoute.coords && mainRoute.coords.length > 0 && (
                    <Polyline 
                        key={`main-${mainRoute.isReachable}`}
                        positions={mainRoute.coords} 
                        pathOptions={{
                            color: mainRoute.isReachable ? "#16a34a" : "#dc2626",
                            weight: 8,
                            opacity: 0.9,
                            lineJoin: "round"
                        }}
                    >
                        <Popup>
                            <b>Main Route ({mainRoute.isReachable ? "Reachable" : "Not Reachable"})</b><br/>
                            Distance: {mainRoute.distanceKm.toFixed(1)} km
                        </Popup>
                    </Polyline>
                )}

                {/* Charging Stations Markers */}
                {stations.map((station, idx) => (
                    <Marker
                        key={idx}
                        position={[parseFloat(station.latitude), parseFloat(station.longitude)]}
                        icon={createStopIcon(idx + 1, station.status, station.isPlannedStop)}
                    >
                        <Popup>
                            <div style={{ color: '#111' }}>
                                <h4 style={{ margin: '0 0 5px 0' }}>
                                    {station.isPlannedStop ? '⭐ Recommended Stop' : `⚡ Stop ${idx + 1}`}: {station.name}
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                                    {station.connector_type} • {station.power_kw}kW
                                </p>
                                {station.status && (
                                    <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>
                                        Status: {station.status}
                                        {typeof station.expected_wait_minutes === 'number' && station.expected_wait_minutes > 0
                                            ? ` | Wait ~${station.expected_wait_minutes} min`
                                            : ''}
                                    </p>
                                )}
                                {station.distance !== undefined && station.distance !== null && (
                                    <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>{station.distance} km from route</p>
                                )}
                                <button 
                                    onClick={() => setSelectedStationForBooking(station)}
                                    style={{ 
                                        display: 'inline-block', marginTop: '8px', marginRight: '8px', padding: '4px 8px', 
                                        background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', 
                                        fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' 
                                    }}
                                >
                                    ⚡ Book Now
                                </button>
                                <a 
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: 'inline-block', marginTop: '8px', padding: '4px 8px', background: '#f59e0b', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}
                                >
                                    🧭 Get Directions
                                </a>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                <FitBounds coords={bounds} />
            </MapContainer>

            <div style={{ padding: '0.8rem', display: 'flex', justifyContent: 'center', gap: '20px', background: 'rgba(0,0,0,0.2)', fontSize: '0.85rem' }}>
                <span>🟢 Start</span>
                <span>🔴 End</span>
                <span>⚡ Charging Station</span>
                <span><span style={{color: '#22c55e', fontWeight: 'bold'}}>—</span> Reachable</span>
                <span><span style={{color: '#ef4444', fontWeight: 'bold'}}>—</span> Not Reachable</span>
            </div>

            {selectedStationForBooking && (
                <BookingModal 
                    station={selectedStationForBooking} 
                    onClose={() => setSelectedStationForBooking(null)}
                    getToken={getToken}
                    isAuthenticated={isAuthenticated}
                />
            )}
        </div>
    );
};

export default RouteMap;
