"use client";

import { useEffect, useState } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { momentAgo } from "@/lib/momentAgo";
import { useRelativeTimeTick } from "@/lib/use-relative-time-tick";
import { Location, LocationHistoryEntry } from "@/components/interfaces/location.interface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Globe, MapPin, User, Link, Smartphone,
  Monitor, Maximize2, ExternalLink, Clock, RefreshCw,
  Calendar, Tag, Wifi, Satellite, Battery, Signal,
  Cpu, HardDrive,
} from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const VisitorTrackMap = dynamic(
  () => import("@/components/map/VisitorTrackMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] bg-muted animate-pulse rounded-lg" />
    ),
  }
);

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string | number | null;
  mono?: boolean;
}

const InfoRow = ({ icon, label, value, mono }: InfoRowProps) => (
  <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
    <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </p>
      {value ? (
        <p className={`text-sm break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground/40">—</p>
      )}
    </div>
  </div>
);

export default function LocationPage({
  params: { locationId },
}: {
  params: { locationId: string };
}) {
  useRelativeTimeTick();
  const router = useRouter();
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const locationRef = ref(database, `locations/${locationId}`);
    return onValue(
      locationRef,
      (snapshot) => {
        const data = snapshot.val();
        setLocation(data ? { ...data, id: locationId } : null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
  }, [locationId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center">
        <MapPin className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <p className="text-sm font-medium">{error ? `Error: ${error}` : "Location not found."}</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex items-center gap-4 px-6 py-5 border-b border-border/60">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold tracking-tight truncate">
              {location.nickname || location.ip || "Location Detail"}
            </h1>
            {location.deviceType && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {location.deviceType}
              </Badge>
            )}
            {location.locationSource === "gps" && (
              <Badge variant="outline" className="gap-1 text-xs border-blue-300 text-blue-600 shrink-0">
                <Satellite className="h-3 w-3" /> GPS
              </Badge>
            )}
            {location.locationSource === "ip" && (
              <Badge variant="outline" className="gap-1 text-xs border-orange-300 text-orange-600 shrink-0">
                <Globe className="h-3 w-3" /> IP · city-level
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            ID: <span className="font-mono text-xs">{locationId}</span>
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "IP Address", value: location.ip, icon: <Globe className="h-4 w-4 text-blue-500" /> },
            { label: "Timezone", value: location.userTimezone, icon: <Clock className="h-4 w-4 text-violet-500" /> },
            { label: "Language", value: location.userLanguage, icon: <Wifi className="h-4 w-4 text-orange-500" /> },
            { label: "Screen", value: location.screenWidth ? `${location.screenWidth}×${location.screenHeight}` : undefined, icon: <Maximize2 className="h-4 w-4 text-green-500" /> },
          ].map(({ label, value, icon }) => (
            <Card key={label} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  {icon}
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                </div>
                <p className="text-sm font-medium truncate">{value || "—"}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/60">
            <div className="px-5 py-3 border-b border-border/40">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Network & Identity</p>
            </div>
            <CardContent className="px-5 py-1">
              <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="IP Address" value={location.ip} mono />
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Coordinates" value={`${location.latitude?.toFixed(6)}, ${location.longitude?.toFixed(6)}`} mono />
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="User ID" value={location.userId} mono />
              <InfoRow icon={<Link className="h-3.5 w-3.5" />} label="Share Link ID" value={location.shareLinkId} mono />
              <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Nickname" value={location.nickname} />
              <InfoRow icon={<ExternalLink className="h-3.5 w-3.5" />} label="Referrer" value={location.referrer} />
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <div className="px-5 py-3 border-b border-border/40">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Device & Browser</p>
            </div>
            <CardContent className="px-5 py-1">
              <InfoRow icon={<Smartphone className="h-3.5 w-3.5" />} label="Device ID" value={location.deviceId} mono />
              <InfoRow icon={<Monitor className="h-3.5 w-3.5" />} label="Device Type" value={location.deviceType} />
              <InfoRow icon={<Maximize2 className="h-3.5 w-3.5" />} label="Screen Size" value={location.screenWidth ? `${location.screenWidth}×${location.screenHeight}` : undefined} />
              <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Language" value={location.userLanguage} />
              <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Timezone" value={location.userTimezone} />
              <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Created" value={momentAgo(location.createdAt ?? 0)} />
              <InfoRow icon={<RefreshCw className="h-3.5 w-3.5" />} label="Updated" value={momentAgo(location.updatedAt ?? 0)} />
            </CardContent>
          </Card>
        </div>

        {/* IP Geolocation enrichment */}
        {location.locationSource === "ip" && (
          <Card className="border-orange-200 dark:border-orange-900">
            <div className="px-5 py-3 border-b border-orange-100 dark:border-orange-900 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">IP Geolocation</p>
              <Badge variant="outline" className="gap-1 text-xs border-orange-300 text-orange-600">
                <Globe className="h-3 w-3" /> City-level · source: ipapi.co
              </Badge>
            </div>
            <CardContent className="px-5 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "City", value: location.ipCity },
                  { label: "Region", value: location.ipRegion },
                  { label: "Country", value: location.ipCountry },
                  { label: "ISP / Org", value: location.ipIsp },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-orange-50 dark:bg-orange-950/30 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-500 mb-0.5">{label}</p>
                    <p className="text-sm">{value || "—"}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Device Fingerprint */}
        {(location.batteryLevel != null || location.networkType ||
          location.hardwareConcurrency != null || location.platform) && (
          <Card className="border-border/60">
            <div className="px-5 py-3 border-b border-border/40">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Device Fingerprint</p>
            </div>
            <CardContent className="px-5 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {location.batteryLevel != null && (
                  <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Battery className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Battery</p>
                    </div>
                    <p className="text-sm font-medium">{location.batteryLevel}%</p>
                    {location.batteryCharging != null && (
                      <p className="text-xs text-muted-foreground">{location.batteryCharging ? "⚡ charging" : "on battery"}</p>
                    )}
                  </div>
                )}
                {location.networkType && (
                  <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Signal className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Network</p>
                    </div>
                    <p className="text-sm font-medium">{location.networkType}</p>
                    {location.networkDownlink != null && (
                      <p className="text-xs text-muted-foreground">{location.networkDownlink} Mbps · {location.networkRtt}ms RTT</p>
                    )}
                  </div>
                )}
                {location.hardwareConcurrency != null && (
                  <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">CPU Cores</p>
                    </div>
                    <p className="text-sm font-medium">{location.hardwareConcurrency}</p>
                  </div>
                )}
                {location.deviceMemory != null && (
                  <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">RAM</p>
                    </div>
                    <p className="text-sm font-medium">~{location.deviceMemory} GB</p>
                  </div>
                )}
                {location.platform && (
                  <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Platform</p>
                    </div>
                    <p className="text-sm font-medium">{location.platform}</p>
                  </div>
                )}
                {location.maxTouchPoints != null && (
                  <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Touch Points</p>
                    </div>
                    <p className="text-sm font-medium">{location.maxTouchPoints}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Agent */}
        <Card className="border-border/60">
          <div className="px-5 py-3 border-b border-border/40">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">User Agent</p>
          </div>
          <CardContent className="px-5 py-4">
            <p className="text-xs font-mono text-muted-foreground break-all leading-relaxed">
              {location.userAgent || "—"}
            </p>
          </CardContent>
        </Card>

        {/* Movement History */}
        {location.history && location.history.length > 0 && (
          <Card className="border-border/60">
            <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Movement History</p>
              <Badge variant="secondary" className="text-xs tabular-nums">{location.history.length} pings</Badge>
            </div>
            <CardContent className="px-5 py-3 max-h-64 overflow-y-auto">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/60" />
                <div className="space-y-0">
                  {[...location.history].reverse().map((entry: LocationHistoryEntry, i) => (
                    <div key={i} className="flex items-start gap-3 py-2">
                      <div className={`mt-1 w-3.5 h-3.5 rounded-full border-2 shrink-0 z-10 ${
                        entry.locationSource === "gps"
                          ? "bg-blue-500 border-blue-300"
                          : "bg-orange-400 border-orange-200"
                      }`} />
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs text-muted-foreground">
                            {entry.latitude.toFixed(5)}, {entry.longitude.toFixed(5)}
                          </code>
                          {entry.accuracy != null && (
                            <span className="text-xs text-muted-foreground/60">±{Math.round(entry.accuracy)}m</span>
                          )}
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            entry.locationSource === "gps"
                              ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                              : "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
                          }`}>
                            {entry.locationSource === "gps" ? "GPS" : "IP"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {momentAgo(entry.ts)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Map */}
        <Card className="border-border/60">
          <div className="px-5 py-3 border-b border-border/40 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Movement map</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Green <span className="font-medium text-emerald-700">S</span> = start · Time-gradient line = path (oldest blue → newest green) · Dashed = IP · Pulse = live position
              </p>
            </div>
            <code className="text-xs text-muted-foreground shrink-0">
              {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
            </code>
          </div>
          <div className="p-4">
            <VisitorTrackMap location={location} height={380} />
          </div>
        </Card>

      </div>
    </div>
  );
}
