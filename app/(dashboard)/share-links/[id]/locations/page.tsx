'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { database } from '@/lib/firebase';
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft, MapPin, Clock, Smartphone, Globe,
  Languages, Monitor,
} from 'lucide-react';
import { Location } from '@/components/interfaces/location.interface';
import { momentAgo } from '@/lib/momentAgo';
import { handleBrowserUserInfoToReadable } from '@/lib/utils';

const LocationsPage = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const linkId = params.id as string;

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
        toast({ title: "Error", description: "Failed to load locations.", variant: "destructive" });
        setLoading(false);
      }
    );
  }, [toast, linkId]);

  const deviceIcon = (type?: string) => {
    if (!type) return <Monitor className="h-3.5 w-3.5" />;
    return type.toLowerCase().includes('mobile')
      ? <Smartphone className="h-3.5 w-3.5" />
      : <Monitor className="h-3.5 w-3.5" />;
  };

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
            <h1 className="text-xl font-semibold tracking-tight">Link Insights</h1>
            {!loading && (
              <Badge variant="secondary" className="text-xs tabular-nums">
                {locations.length} pings
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            {linkId}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
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
          <Card className="border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visitor</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coordinates</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Browser</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Language</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timezone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((location) => {
                    const browser = handleBrowserUserInfoToReadable(location.userAgent || '');
                    return (
                      <TableRow key={location.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">
                              {location.nickname || <span className="text-muted-foreground/50 italic">Anonymous</span>}
                            </p>
                            {location.ip && (
                              <p className="text-xs font-mono text-muted-foreground">{location.ip}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {location.latitude?.toFixed(4)}, {location.longitude?.toFixed(4)}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {momentAgo(location.createdAt ?? 0)}
                          </div>
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
                            <span className="truncate max-w-[100px]">{browser.browser || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Languages className="h-3.5 w-3.5 shrink-0" />
                            {location.userLanguage || '—'}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {location.userTimezone || '—'}
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
    </div>
  );
};

export default LocationsPage;
