import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom icons for origin and destination
const originIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const destinationIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Component to auto-fit map bounds
function FitBounds({ positions }) {
    const map = useMap();

    useEffect(() => {
        if (positions && positions.length > 0) {
            const bounds = L.latLngBounds(positions);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [positions, map]);

    return null;
}

const RouteMap = ({ originCoords, destCoords, distance }) => {
    const [routePath, setRoutePath] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!originCoords || !destCoords) return;

        // Fetch actual driving route from OSRM (Open Source Routing Machine)
        const fetchRoute = async () => {
            try {
                setLoading(true);
                const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=full&geometries=geojson`;

                const response = await fetch(url);
                const data = await response.json();

                if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                    // Convert GeoJSON coordinates to Leaflet format [lat, lng]
                    const coordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    setRoutePath(coordinates);
                } else {
                    // Fallback to straight line if routing fails
                    setRoutePath([
                        [originCoords.lat, originCoords.lon],
                        [destCoords.lat, destCoords.lon]
                    ]);
                }
            } catch (error) {
                console.error('Routing error:', error);
                // Fallback to straight line
                setRoutePath([
                    [originCoords.lat, originCoords.lon],
                    [destCoords.lat, destCoords.lon]
                ]);
            } finally {
                setLoading(false);
            }
        };

        fetchRoute();
    }, [originCoords, destCoords]);

    if (!originCoords || !destCoords) {
        return null;
    }

    const originPos = [originCoords.lat, originCoords.lon];
    const destPos = [destCoords.lat, destCoords.lon];
    const center = [
        (originCoords.lat + destCoords.lat) / 2,
        (originCoords.lon + destCoords.lon) / 2
    ];

    // Polyline options for the route
    const polylineOptions = {
        color: '#667eea',
        weight: 5,
        opacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round'
    };

    return (
        <div className="route-map-container" style={{
            height: '450px',
            width: '100%',
            borderRadius: '16px',
            overflow: 'hidden',
            marginTop: '24px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
            border: '2px solid rgba(102, 126, 234, 0.2)',
            position: 'relative'
        }}>
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(102, 126, 234, 0.9)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    zIndex: 1000,
                    fontSize: '14px',
                    fontWeight: '500'
                }}>
                    Loading route...
                </div>
            )}
            <MapContainer
                center={center}
                zoom={10}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Origin Marker */}
                <Marker position={originPos} icon={originIcon}>
                    <Popup>
                        <strong>📍 Origin</strong>
                        <br />
                        Starting Point
                    </Popup>
                </Marker>

                {/* Destination Marker */}
                <Marker position={destPos} icon={destinationIcon}>
                    <Popup>
                        <strong>🎯 Destination</strong>
                        <br />
                        End Point
                        <br />
                        <em>Distance: {distance} km</em>
                    </Popup>
                </Marker>

                {/* Actual Driving Route */}
                {routePath.length > 0 && (
                    <Polyline positions={routePath} pathOptions={polylineOptions} />
                )}

                {/* Auto-fit bounds */}
                <FitBounds positions={routePath.length > 0 ? routePath : [originPos, destPos]} />
            </MapContainer>
        </div>
    );
};

export default RouteMap;