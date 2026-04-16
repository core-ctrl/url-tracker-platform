'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { haversineMeters } from '@/lib/geo';

type LiveStatus = 'live' | 'idle' | 'stale' | 'paused';

interface LiveMarkerProps {
  position: [number, number];
  status: LiveStatus;
  color?: string;
  /** popup HTML or plain text; if omitted, no popup attached. */
  popupHtml?: string;
  /** rAF glide duration (ms). Defaults to 600ms. */
  glideMs?: number;
  /** Jumps larger than this (meters) skip the animation and snap. */
  maxGlideMeters?: number;
  /** When true, call `map.panTo(next)` after each target update. */
  follow?: boolean;
}

const statusColors: Record<LiveStatus, { fill: string; ring: string }> = {
  live: { fill: '#2563eb', ring: 'rgba(37, 99, 235, 0.5)' },
  idle: { fill: '#f59e0b', ring: 'rgba(245, 158, 11, 0.45)' },
  stale: { fill: '#64748b', ring: 'rgba(100, 116, 139, 0.4)' },
  paused: { fill: '#8b5cf6', ring: 'rgba(139, 92, 246, 0.45)' },
};

function buildIcon(status: LiveStatus, color?: string): L.DivIcon {
  const cls = color ? '' : status;
  const { fill } = color ? { fill: color } : statusColors[status];
  return L.divIcon({
    className: `track-marker-live track-live-${cls || 'live'}`,
    html: `<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
  <div class="track-live-dot track-live-dot--${status}" style="width:18px;height:18px;border-radius:9999px;background:${fill};border:3px solid #fff;box-shadow:0 2px 10px rgba(15,23,42,0.35);"></div>
</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

/**
 * Smoothly moves a Leaflet marker toward `position` changes via requestAnimationFrame.
 * Snaps instantly for jumps greater than `maxGlideMeters` to avoid cross-city slides.
 */
export function LiveMarker({
  position,
  status,
  color,
  popupHtml,
  glideMs = 600,
  maxGlideMeters = 500,
  follow = false,
}: LiveMarkerProps) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef<[number, number]>(position);
  const followRef = useRef<boolean>(follow);

  useEffect(() => {
    followRef.current = follow;
  }, [follow]);

  useEffect(() => {
    const icon = buildIcon(status, color);
    const marker = L.marker(position, { icon, keyboard: false }).addTo(map);
    if (popupHtml) marker.bindPopup(popupHtml);
    markerRef.current = marker;
    targetRef.current = position;

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      map.removeLayer(marker);
      markerRef.current = null;
    };
    // Initial mount only. Position/status/color/popup updates are handled by the
    // dedicated effects below so we avoid re-creating the marker on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.setIcon(buildIcon(status, color));
  }, [status, color]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (popupHtml) {
      if (marker.getPopup()) {
        marker.setPopupContent(popupHtml);
      } else {
        marker.bindPopup(popupHtml);
      }
    }
  }, [popupHtml]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const from = marker.getLatLng();
    const fromTuple: [number, number] = [from.lat, from.lng];
    targetRef.current = position;

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const jumpM = haversineMeters(fromTuple, position);
    if (!Number.isFinite(jumpM) || jumpM <= 0.1) return;

    if (jumpM > maxGlideMeters || glideMs <= 0) {
      marker.setLatLng(position);
      if (followRef.current) map.panTo(position, { animate: true, duration: 0.4 });
      return;
    }

    const start = performance.now();
    const fromLat = from.lat;
    const fromLng = from.lng;
    const toLat = position[0];
    const toLng = position[1];

    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / glideMs);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const nextLat = fromLat + (toLat - fromLat) * eased;
      const nextLng = fromLng + (toLng - fromLng) * eased;
      marker.setLatLng([nextLat, nextLng]);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        if (followRef.current) map.panTo([toLat, toLng], { animate: true, duration: 0.4 });
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }, [position, map, glideMs, maxGlideMeters]);

  return null;
}

export default LiveMarker;
