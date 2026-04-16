'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { database } from '@/lib/firebase';
import { ref, onValue, query, orderByChild, equalTo, get, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft, MapPin, Clock, Smartphone, Globe,
  Languages, Monitor, Copy, ExternalLink, Pencil,
  Satellite, Download, Trash2, Search, Link2,
} from 'lucide-react';
import { Location } from '@/components/interfaces/location.interface';
import { ShareLink } from '@/components/interfaces/sharelink.interface';
import { momentAgo } from '@/lib/momentAgo';
import { handleBrowserUserInfoToReadable } from '@/lib/utils';
import { getPublicOrigin } from '@/lib/site-url-client';

const LeafletMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] bg-muted animate-pulse rounded-lg border border-border/60" />
  ),
});

const MAP_MAX_MARKERS = 50;

type SourceFilter = 'all' | 'gps' | 'ip';
type DeviceFilter = 'all' | 'mobile' | 'desktop';
type SortOrder = 'newest' | 'oldest';

function historyLen(loc: Location): number {
  const h = loc.history;
  if (!h) return 0;
  if (Array.isArray(h)) return h.length;
  if (typeof h === 'object') return Object.values(h as Record<string, unknown>).length;
  return 0;
}

function activityTs(loc: Location): number {
  return loc.updatedAt ?? loc.createdAt ?? 0;
}

function topCountry(locs: Location[]): string | null {
  const counts = new Map<string, number>();
  for (const l of locs) {
    const c = l.ipCountry?.trim();
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  counts.forEach((v: number, k: string) => {
    if (v > n) {
      n = v;
      best = k;
    }
  });
  return best;
}

function geoLine(loc: Location): string {
  const parts = [loc.ipCity, loc.ipRegion, loc.ipCountry].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return '—';
}

function getTrackUrl(linkId: string): string {
  const origin = getPublicOrigin();
  return `${origin}/track?id=${linkId}`;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

function escapeCsvCell(v: string | number | undefined | null): string {
  const s = v === undefined || v === null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const LocationsPage = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [shareLinkMeta, setShareLinkMeta] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const linkId = params.id as string;

  useEffect(() => {
    if (!linkId) return;
    get(ref(database, `shareLinks/${linkId}`)).then((snap) => {
      setShareLinkMeta(snap.exists() ? (snap.val() as ShareLink) : null);
    });
  }, [linkId]);

  useEffect(() => {
    if (!linkId) return;
    const locationsRef = ref(database, 'locations');
    const q = query(locationsRef, orderByChild('shareLinkId'), equalTo(linkId));

    return onValue(
      q,
      (snapshot) => {
        const data = snapshot.val();
        setLocations(
          data
            ? Object.entries(data).map(([id, loc]) => ({ ...(loc as Location), id }))
            : []
        );
        setLoading(false);
      },
      (error) => {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to load locations.', variant: 'destructive' });
        setLoading(false);
      }
    );
  }, [toast, linkId]);

  const linkTitle =
    shareLinkMeta?.name?.trim() ||
    shareLinkMeta?.title?.trim() ||
    null;

  const copyTrackUrl = useCallback(() => {
    const url = getTrackUrl(linkId);
    navigator.clipboard.writeText(url);
    toast({ title: 'Track URL copied', duration: 2000 });
  }, [linkId, toast]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...locations];

    if (sourceFilter === 'gps') list = list.filter((l) => l.locationSource === 'gps');
    if (sourceFilter === 'ip') list = list.filter((l) => l.locationSource === 'ip');

    if (deviceFilter === 'mobile') {
      list = list.filter((l) => (l.deviceType || '').toLowerCase().includes('mobile'));
    }
    if (deviceFilter === 'desktop') {
      list = list.filter((l) => !(l.deviceType || '').toLowerCase().includes('mobile'));
    }

    if (q) {
      list = list.filter((l) => {
        const ua = (l.userAgent || '').toLowerCase();
        const readable = handleBrowserUserInfoToReadable(l.userAgent || '');
        const browserStr = `${readable.browser || ''} ${readable.os || ''}`.toLowerCase();
        return (
          (l.ip || '').toLowerCase().includes(q) ||
          (l.id || '').toLowerCase().includes(q) ||
          (l.deviceId || '').toLowerCase().includes(q) ||
          (l.ipCountry || '').toLowerCase().includes(q) ||
          (l.referrer || '').toLowerCase().includes(q) ||
          ua.includes(q) ||
          browserStr.includes(q)
        );
      });
    }

    list.sort((a, b) =>
      sortOrder === 'newest'
        ? activityTs(b) - activityTs(a)
        : activityTs(a) - activityTs(b)
    );
    return list;
  }, [locations, search, sourceFilter, deviceFilter, sortOrder]);

  const stats = useMemo(() => {
    const gps = locations.filter((l) => l.locationSource === 'gps').length;
    const ip = locations.filter((l) => l.locationSource === 'ip').length;
    let last = 0;
    for (const l of locations) {
      const t = activityTs(l);
      if (t > last) last = t;
    }
    const pings = locations.reduce((sum, l) => sum + historyLen(l), 0);
    return {
      visitors: locations.length,
      gps,
      ip,
      lastActivity: last,
      topCountry: topCountry(locations),
      totalPings: pings,
    };
  }, [locations]);

  const mapLocationsAllCoords = useMemo(
    () =>
      filteredSorted.filter(
        (l) =>
          typeof l.latitude === 'number' &&
          typeof l.longitude === 'number' &&
          !Number.isNaN(l.latitude) &&
          !Number.isNaN(l.longitude)
      ),
    [filteredSorted]
  );

  const mapLocations = useMemo(
    () => mapLocationsAllCoords.slice(0, MAP_MAX_MARKERS),
    [mapLocationsAllCoords]
  );

  const mapTruncated = mapLocationsAllCoords.length > MAP_MAX_MARKERS;

  const mapCenter = useMemo((): [number, number] => {
    if (mapLocations.length === 0) return [25.276987, 55.296249];
    let lat = 0;
    let lng = 0;
    for (const l of mapLocations) {
      lat += l.latitude!;
      lng += l.longitude!;
    }
    return [lat / mapLocations.length, lng / mapLocations.length];
  }, [mapLocations]);

  const mapZoom = mapLocations.length <= 1 ? 12 : mapLocations.length <= 5 ? 8 : 4;

  const exportCsv = useCallback(() => {
    const headers = [
      'id',
      'createdAt',
      'updatedAt',
      'latitude',
      'longitude',
      'locationSource',
      'ip',
      'ipCountry',
      'ipCity',
      'deviceType',
      'userAgent',
    ];
    const rows = filteredSorted.map((l) =>
      [
        l.id,
        l.createdAt ?? '',
        l.updatedAt ?? '',
        l.latitude ?? '',
        l.longitude ?? '',
        l.locationSource ?? '',
        l.ip ?? '',
        l.ipCountry ?? '',
        l.ipCity ?? '',
        l.deviceType ?? '',
        truncate(l.userAgent || '', 200),
      ].map(escapeCsvCell)
    );
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `link-insights-${linkId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exported', description: `${filteredSorted.length} row(s).` });
  }, [filteredSorted, linkId, toast]);

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await remove(ref(database, `locations/${deleteTarget.id}`));
      toast({ title: 'Visitor removed' });
      setDeleteTarget(null);
    } catch {
      toast({
        title: 'Error',
        description: 'Could not remove this record.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const deviceIcon = (type?: string) => {
    if (!type) return <Monitor className="h-3.5 w-3.5" />;
    return type.toLowerCase().includes('mobile') ? (
      <Smartphone className="h-3.5 w-3.5" />
    ) : (
      <Monitor className="h-3.5 w-3.5" />
    );
  };

  const filterChip = (
    active: boolean,
    onClick: () => void,
    label: string
  ) => (
    <Button
      type="button"
      variant={active ? 'secondary' : 'outline'}
      size="sm"
      className="h-8 text-xs"
      onClick={onClick}
    >
      {label}
    </Button>
  );

  const hasFilters =
    search.trim() !== '' ||
    sourceFilter !== 'all' ||
    deviceFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setSourceFilter('all');
    setDeviceFilter('all');
  };

  const filteredEmpty = !loading && locations.length > 0 && filteredSorted.length === 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between px-6 py-5 border-b border-border/60">
        <div className="flex items-start gap-4 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 mt-0.5"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">Link Insights</h1>
              {!loading && (
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {stats.visitors} visitor{stats.visitors === 1 ? '' : 's'}
                </Badge>
              )}
            </div>
            {linkTitle && (
              <p className="text-sm text-foreground/90 font-medium mt-1 truncate">{linkTitle}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{linkId}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={copyTrackUrl}>
            <Copy className="h-3.5 w-3.5" />
            Copy URL
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => window.open(getTrackUrl(linkId), '_blank')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open track
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => router.push(`/share-links?edit=${encodeURIComponent(linkId)}`)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit link
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">No pings yet</p>
            <p className="text-sm text-muted-foreground">
              Share your tracking link — location data will appear here once visited.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Visitors
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">{stats.visitors}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    GPS / IP
                  </p>
                  <p className="text-sm font-medium tabular-nums">
                    <span className="text-blue-600">{stats.gps}</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-orange-600">{stats.ip}</span>
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Last activity
                  </p>
                  <p className="text-sm font-medium truncate">
                    {stats.lastActivity ? momentAgo(stats.lastActivity) : '—'}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Top country
                  </p>
                  <p className="text-sm font-medium truncate">{stats.topCountry || '—'}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60 col-span-2 sm:col-span-1 lg:col-span-1">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Trail points
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">{stats.totalPings}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60 p-4 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative max-w-md w-full">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search IP, device id, country, referrer, UA…"
                    className="h-9 pl-8"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Sort</span>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={exportCsv}>
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Source
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {filterChip(sourceFilter === 'all', () => setSourceFilter('all'), 'All')}
                  {filterChip(sourceFilter === 'gps', () => setSourceFilter('gps'), 'GPS')}
                  {filterChip(sourceFilter === 'ip', () => setSourceFilter('ip'), 'IP')}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Device
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {filterChip(deviceFilter === 'all', () => setDeviceFilter('all'), 'All')}
                  {filterChip(deviceFilter === 'mobile', () => setDeviceFilter('mobile'), 'Mobile')}
                  {filterChip(deviceFilter === 'desktop', () => setDeviceFilter('desktop'), 'Desktop')}
                </div>
              </div>
            </Card>

            {filteredEmpty && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No rows match your filters.
                {hasFilters && (
                  <Button variant="link" className="h-auto p-0 ml-1" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {mapLocations.length > 0 && (
                <Card className="border-border/60 overflow-hidden lg:col-span-2">
                  <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Map
                    </p>
                    {mapTruncated && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        Showing {MAP_MAX_MARKERS} of {mapLocationsAllCoords.length} on map
                      </Badge>
                    )}
                  </div>
                  <LeafletMap
                    userLocations={mapLocations}
                    center={mapCenter}
                    zoom={mapZoom}
                    style={{ height: '280px', width: '100%' }}
                  />
                </Card>
              )}
              {!filteredEmpty && (
                <Card
                  className={`border-border/60 overflow-hidden ${
                    mapLocations.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5'
                  }`}
                >
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                            Visitor
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                            Coords
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                            Source
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                            Geo
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                            Pings
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                            Referrer
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                            Updated
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                            Device
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                            Browser
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                            Lang / TZ
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right whitespace-nowrap">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSorted.map((location) => {
                          const browser = handleBrowserUserInfoToReadable(location.userAgent || '');
                          const refUrl = location.referrer || '';
                          return (
                            <TableRow
                              key={location.id}
                              className="hover:bg-muted/30 cursor-pointer"
                              onClick={() => router.push(`/locations/${location.id}`)}
                            >
                              <TableCell>
                                <div>
                                  <p className="text-sm font-medium">
                                    {location.nickname || (
                                      <span className="text-muted-foreground/50 italic">Anonymous</span>
                                    )}
                                  </p>
                                  {location.ip && (
                                    <p className="text-xs font-mono text-muted-foreground">{location.ip}</p>
                                  )}
                                  {location.deviceId && (
                                    <p className="text-[10px] font-mono text-muted-foreground/70 truncate max-w-[140px]">
                                      {location.deviceId}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">
                                  {location.latitude != null && location.longitude != null
                                    ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                                    : '—'}
                                </code>
                              </TableCell>
                              <TableCell>
                                {location.locationSource === 'gps' && (
                                  <Badge
                                    variant="outline"
                                    className="gap-0.5 text-[10px] border-blue-300 text-blue-600 shrink-0"
                                  >
                                    <Satellite className="h-3 w-3" />
                                    GPS
                                  </Badge>
                                )}
                                {location.locationSource === 'ip' && (
                                  <Badge
                                    variant="outline"
                                    className="gap-0.5 text-[10px] border-orange-300 text-orange-600 shrink-0"
                                  >
                                    <Globe className="h-3 w-3" />
                                    IP
                                  </Badge>
                                )}
                                {!location.locationSource && (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[120px]">
                                <span className="line-clamp-2">{geoLine(location)}</span>
                              </TableCell>
                              <TableCell className="tabular-nums text-sm text-muted-foreground">
                                {historyLen(location)}
                              </TableCell>
                              <TableCell className="max-w-[100px]">
                                {refUrl ? (
                                  <span
                                    className="text-xs text-muted-foreground truncate block"
                                    title={refUrl}
                                  >
                                    {truncate(refUrl, 40)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                  {momentAgo(activityTs(location))}
                                </div>
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                  Created {momentAgo(location.createdAt ?? 0)}
                                </p>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  {deviceIcon(location.deviceType)}
                                  {location.deviceType || '—'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Globe className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate max-w-[80px]">{browser.browser || '—'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[100px]">
                                <div className="flex items-center gap-1">
                                  <Languages className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{location.userLanguage || '—'}</span>
                                </div>
                                <p className="truncate mt-0.5 opacity-80">{location.userTimezone || '—'}</p>
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Open detail"
                                    onClick={() => router.push(`/locations/${location.id}`)}
                                  >
                                    <Link2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Remove visitor"
                                    onClick={() => setDeleteTarget(location)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </div>
          </>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this visitor?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This deletes stored location data for device{' '}
            <span className="font-mono text-xs">{deleteTarget?.id}</span>. Open RTDB rules may allow
            anyone with the dashboard URL to do this; lock down in production.
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? 'Removing…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocationsPage;
