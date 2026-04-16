'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from './interfaces/location.interface';
import { formatLocalDateTime } from '@/lib/momentAgo';
import VisitorTrackMap from './map/VisitorTrackMap';

interface MapProps {
  userLocations: Location | Location[];
  center?: [number, number];
  zoom?: number;
  style?: React.CSSProperties;
  preferCanvas?: boolean;
  /** Force single-visitor full track UI even if `userLocations` is a 1-length array. */
  trackMode?: boolean;
  /** Height for the single-visitor track map. Falls back to style.height or 420. */
  trackHeight?: number;
}

/**
 * Thin facade:
 *  - 1 visitor → renders the rich `VisitorTrackMap` with controls, metrics, scrubber, follow.
 *  - N visitors → classic overview pins (no trails, no controls). For trails across many
 *    visitors, use `MultiVisitorTrackMap` directly.
 */
const Map: React.FC<MapProps> = ({
  userLocations,
  center = [25.276987, 55.296249],
  zoom = 5,
  style = { height: '400px', width: '100%' },
  preferCanvas = true,
  trackMode,
  trackHeight,
}) => {
  const locations = Array.isArray(userLocations)
    ? userLocations
    : userLocations
      ? [userLocations]
      : [];

  const single =
    (trackMode && locations.length >= 1) || locations.length === 1;

  if (single) {
    const loc = locations[0];
    const height =
      trackHeight ??
      (typeof style?.height === 'number' ? (style.height as number) : 420);
    return <VisitorTrackMap location={loc} height={height} />;
  }

  const multiMarkers = locations.filter(
    (l) =>
      typeof l.latitude === 'number' &&
      typeof l.longitude === 'number' &&
      Number.isFinite(l.latitude) &&
      Number.isFinite(l.longitude)
  );

  return (
    <MapContainer center={center} zoom={zoom} style={style} preferCanvas={preferCanvas}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {multiMarkers.map((location, index) => (
        <Marker
          icon={L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
            shadowSize: [41, 41],
            shadowAnchor: [12, 41],
          })}
          key={location.id || String(index)}
          position={[location.latitude!, location.longitude!]}
        >
          <Popup>
            <div>
              <h2 className="text-sm font-semibold m-0">Location</h2>
              {location.createdAt != null && (
                <p className="text-xs m-0 mt-1">
                  Created: {formatLocalDateTime(location.createdAt)}
                </p>
              )}
              <p className="text-xs m-0 mt-1">Latitude: {location.latitude}</p>
              <p className="text-xs m-0">Longitude: {location.longitude}</p>
              {location.userId && <p className="text-xs m-0 mt-1">User ID: {location.userId}</p>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default Map;
