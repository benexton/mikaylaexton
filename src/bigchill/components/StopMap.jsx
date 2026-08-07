import { MapContainer, TileLayer, CircleMarker, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// CircleMarker throughout, not L.marker - avoids Leaflet's default marker
// icon needing asset paths that bundlers don't resolve cleanly (same
// approach the-rodeo's map already uses in this repo).
export default function StopMap({ stop, userPosition }) {
  const center = [stop.coords.lat, stop.coords.lng];

  return (
    <div className="bc-map-frame">
      <MapContainer key={stop.id} center={center} zoom={16} scrollWheelZoom={false} className="bc-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle center={center} radius={stop.geofenceRadiusM} pathOptions={{ color: '#ff8a3d', weight: 1, fillOpacity: 0.08 }} />
        <CircleMarker center={center} radius={9} pathOptions={{ color: '#e5622b', fillColor: '#ff8a3d', fillOpacity: 1, weight: 2 }} />
        {userPosition && (
          <CircleMarker
            center={[userPosition.lat, userPosition.lng]}
            radius={7}
            pathOptions={{ color: '#1c1f3a', fillColor: '#9fd8e8', fillOpacity: 1, weight: 2 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
