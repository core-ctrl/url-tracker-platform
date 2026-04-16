'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Button } from '@/components/ui/button';
import { buildVisitorTrack, visitorColor } from '@/lib/track-map-path';
import { momentAgo } from '@/lib/momentAgo';
import type { Location } from '@/components/interfaces/location.interface';

interface MultiVisitorTrackMapProps {
  locations: Location[];
  height?: number;
  /** Hard cap on full trails rendered; overflow shown as simple pins. */
  maxTrails?: number;
}

function visitorIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'track-marker-live',
    html: `<div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
  <div style="width:14px;height:14px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,0.35);"></div>
</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const pinIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
  shadowAnchor: [12, 41],
});

function FitAll({
  points,
  triggerId,
}: {
  points: [number, number][];
  triggerId: number;
}) {
  const map = useMap();
  const last = useRef<number>(-1);

  useEffect(() => {
    if (triggerId === last.current) return;
    last.current = triggerId;
    if (points.length === 0) return;
    try {
      if (points.length === 1) {
        map.setView(points[0], Math.max(map.getZoom(), 11));
        return;
      }
      const bounds = L.latLngBounds(points);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: true });
      }
    } catch {
      /* ignore */
    }
  }, [map, points, triggerId]);

  return null;
}

function FocusOn({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo(target, Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [map, target]);
  return null;
}

type PreparedVisitor = {
  id: string;
  label: string;
  color: string;
  path: [number, number][];
  live: [number, number] | null;
  track: ReturnType<typeof buildVisitorTrack>;
  source: Location;
};

export function MultiVisitorTrackMap({
  locations,
  height = 460,
  maxTrails = 15,
}: MultiVisitorTrackMapProps) {
  const prepared: PreparedVisitor[] = useMemo(() => {
    return locations
      .map<PreparedVisitor | null>((loc) => {
        const track = buildVisitorTrack(loc);
        if (track.path.length === 0) {
          if (
            typeof loc.latitude === 'number' &&
            typeof loc.longitude === 'number' &&
            Number.isFinite(loc.latitude) &&
            Number.isFinite(loc.longitude)
          ) {
            const pos: [number, number] = [loc.latitude!, loc.longitude!];
            return {
              id: loc.id ?? loc.deviceId ?? `${loc.latitude},${loc.longitude}`,
              label:
                loc.nickname ||
                loc.userId ||
                loc.deviceId ||
                loc.ipCity ||
                'Visitor',
              color: visitorColor(loc.id ?? loc.deviceId ?? ''),
              path: [],
              live: pos,
              track,
              source: loc,
            };
          }
          return null;
        }
        return {
          id: loc.id ?? loc.deviceId ?? `${loc.latitude},${loc.longitude}`,
          label:
            loc.nickname ||
            loc.userId ||
            loc.deviceId ||
            loc.ipCity ||
            'Visitor',
          color: visitorColor(loc.id ?? loc.deviceId ?? ''),
          path: track.path,
          live: track.path[track.path.length - 1] ?? null,
          track,
          source: loc,
        };
      })
      .filter((v): v is PreparedVisitor => v !== null);
  }, [locations]);

  const trailed = prepared.slice(0, maxTrails).filter((v) => v.path.length >= 2);
  const pinOverflow = prepared.slice(maxTrails);
  const pinFallback = prepared.filter((v) => v.path.length < 2);

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [focusTarget, setFocusTarget] = useState<[number, number] | null>(null);
  const [fitTrigger, setFitTrigger] = useState<number>(0);

  const allPoints = useMemo<[number, number][]>(() => {
    const out: [number, number][] = [];
    for (const v of prepared) {
      if (hidden.has(v.id)) continue;
      if (v.path.length > 0) out.push(...v.path);
      else if (v.live) out.push(v.live);
    }
    return out;
  }, [prepared, hidden]);

  const center = allPoints[0] ?? [25.276987, 55.296249];

  const toggleHidden = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          {trailed.length} trail{trailed.length === 1 ? '' : 's'}
          {(pinOverflow.length + pinFallback.length) > 0 &&
            ` · ${pinOverflow.length + pinFallback.length} pin${
              pinOverflow.length + pinFallback.length === 1 ? '' : 's'
            }`}
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setHidden(new Set())}
            disabled={hidden.size === 0}
          >
            Show all
          </Button>
          <Button size="sm" variant="outline" onClick={() => setFitTrigger((n) => n + 1)}>
            Fit bounds
          </Button>
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-md border bg-background"
        style={{ height }}
      >
        <MapContainer
          center={center}
          zoom={allPoints.length > 0 ? 11 : 5}
          style={{ height: '100%', width: '100%' }}
          preferCanvas
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <FitAll points={allPoints} triggerId={fitTrigger} />
          <FocusOn target={focusTarget} />

          {trailed
            .filter((v) => !hidden.has(v.id))
            .map((v) => (
              <Polyline
                key={`p-${v.id}`}
                positions={v.path}
                pathOptions={{
                  color: v.color,
                  weight: 4,
                  opacity: 0.85,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            ))}

          {trailed
            .filter((v) => !hidden.has(v.id) && v.live)
            .map((v) => (
              <Marker key={`m-${v.id}`} position={v.live!} icon={visitorIcon(v.color)}>
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>{v.label}</p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
                      {v.path.length} point{v.path.length === 1 ? '' : 's'}
                    </p>
                    {v.source.updatedAt && (
                      <p style={{ fontSize: 12, margin: '4px 0 0' }}>
                        Last ping {momentAgo(v.source.updatedAt)}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

          {[...pinFallback, ...pinOverflow]
            .filter((v) => !hidden.has(v.id) && v.live)
            .map((v) => (
              <Marker key={`pin-${v.id}`} position={v.live!} icon={pinIcon}>
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>{v.label}</p>
                    {v.source.ipCity && (
                      <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
                        {v.source.ipCity}
                        {v.source.ipCountry ? `, ${v.source.ipCountry}` : ''}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>

      {prepared.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {prepared.map((v) => {
            const off = hidden.has(v.id);
            return (
              <div
                key={`leg-${v.id}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${
                  off ? 'opacity-50' : ''
                }`}
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5"
                  onClick={() => toggleHidden(v.id)}
                  aria-pressed={!off}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: v.color }}
                    aria-hidden
                  />
                  <span className="max-w-[140px] truncate">{v.label}</span>
                </button>
                {v.live && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setFocusTarget(v.live!)}
                  >
                    focus
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MultiVisitorTrackMap;
