"use client";

import { useEffect, useState } from "react";
import { database } from "../lib/firebase";
import { ref, onValue, remove, update } from "firebase/database";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  MapPin, Trash2, Pencil, Globe, User, Link, Smartphone,
  Monitor, Maximize2, ExternalLink, Clock, RefreshCw,
  Calendar, Tag, ExternalLink as ViewIcon, Search,
  ChevronLeft, ChevronRight, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import AddressText from "./crumbs/AddressText";
import { Location } from "./interfaces/location.interface";
import { momentAgo } from "@/lib/momentAgo";

const Map = dynamic(() => import("./Map"), { ssr: false });

const PER_PAGE = 15;

function timeLabel(ts?: number) {
  return ts ? momentAgo(ts) : "—";
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string | number | null;
}

const InfoRow = ({ icon, label, value }: InfoRowProps) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
    <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm break-all">{value || <span className="text-muted-foreground/50">—</span>}</p>
    </div>
  </div>
);

const AdminDashboard = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [filtered, setFiltered] = useState<Location[]>([]);
  const [search, setSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedLocation, setEditedLocation] = useState<Location | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const locationsRef = ref(database, "locations");
    return onValue(locationsRef, (snapshot) => {
      const data = snapshot.val();
      const arr = data
        ? Object.entries(data)
            .map(([id, loc]) => ({ ...(loc as Location), id }))
            .filter((l) => l.createdAt)
            .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        : [];
      setLocations(arr);
      setFiltered(arr);
    });
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? locations.filter(
            (l) =>
              l.nickname?.toLowerCase().includes(q) ||
              l.ip?.toLowerCase().includes(q) ||
              l.userTimezone?.toLowerCase().includes(q)
          )
        : locations
    );
    setCurrentPage(1);
  }, [search, locations]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  const handleDelete = async (id: string) => {
    try {
      await remove(ref(database, `locations/${id}`));
      toast({ title: "Location removed" });
      if (selectedLocation?.id === id) setSelectedLocation(null);
    } catch {
      toast({ title: "Error", description: "Failed to remove location.", variant: "destructive" });
    }
  };

  const handleUpdateLocation = async () => {
    if (!editedLocation) return;
    try {
      await update(ref(database, `locations/${editedLocation.id}`), {
        ip: editedLocation.ip,
        latitude: editedLocation.latitude,
        longitude: editedLocation.longitude,
        nickname: editedLocation.nickname,
      });
      setIsEditOpen(false);
      toast({ title: "Location updated" });
      if (selectedLocation?.id === editedLocation.id) setSelectedLocation(editedLocation);
    } catch {
      toast({ title: "Error", description: "Failed to update location.", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Locations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All tracked location pings
          </p>
        </div>
        <Badge variant="secondary" className="tabular-nums text-xs">
          {locations.length} total
        </Badge>
      </div>

      <div className="flex flex-col flex-1 gap-4 p-6">
        {/* Search */}
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by nickname, IP, timezone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Table */}
        <Card className="border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-36">Created</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nickname</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">IP</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coordinates</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center text-sm text-muted-foreground">
                      {search ? "No results match your search." : "No locations tracked yet."}
                    </TableCell>
                  </TableRow>
                )}
                {paginated.map((location) => (
                  <TableRow
                    key={location.id}
                    className={`cursor-pointer transition-colors ${selectedLocation?.id === location.id ? "bg-muted/60" : "hover:bg-muted/30"}`}
                    onClick={() => setSelectedLocation(location)}
                  >
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {timeLabel(location.createdAt)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {location.nickname || <span className="text-muted-foreground/50 italic">—</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {location.ip || "—"}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {location.latitude?.toFixed(4)}, {location.longitude?.toFixed(4)}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                      <AddressText lat={location.latitude ?? 0} lng={location.longitude ?? 0} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Edit"
                          onClick={() => { setEditedLocation(location); setIsEditOpen(true); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Open detail"
                          onClick={() => router.push(`/locations/${location.id}`)}
                        >
                          <ViewIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete"
                          onClick={() => handleDelete(location.id ?? "")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {(currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                const page = start + i;
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="icon"
                    className="h-7 w-7 text-xs"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Selected Location Detail Panel */}
        {selectedLocation && (
          <Card className="border-border/60">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">
                  {selectedLocation.nickname || selectedLocation.ip || "Location Details"}
                </span>
                {selectedLocation.deviceType && (
                  <Badge variant="secondary" className="text-xs">{selectedLocation.deviceType}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { setEditedLocation(selectedLocation); setIsEditOpen(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(selectedLocation.id ?? "")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSelectedLocation(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Network & Identity</p>
                  <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="IP Address" value={selectedLocation.ip} />
                  <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Coordinates" value={`${selectedLocation.latitude?.toFixed(6)}, ${selectedLocation.longitude?.toFixed(6)}`} />
                  <InfoRow icon={<User className="h-3.5 w-3.5" />} label="User ID" value={selectedLocation.userId} />
                  <InfoRow icon={<Link className="h-3.5 w-3.5" />} label="Share Link ID" value={selectedLocation.shareLinkId} />
                  <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Nickname" value={selectedLocation.nickname} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Device & Browser</p>
                  <InfoRow icon={<Smartphone className="h-3.5 w-3.5" />} label="Device ID" value={selectedLocation.deviceId} />
                  <InfoRow icon={<Monitor className="h-3.5 w-3.5" />} label="Device Type" value={selectedLocation.deviceType} />
                  <InfoRow icon={<Maximize2 className="h-3.5 w-3.5" />} label="Screen" value={selectedLocation.screenWidth && selectedLocation.screenHeight ? `${selectedLocation.screenWidth}×${selectedLocation.screenHeight}` : undefined} />
                  <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Language" value={selectedLocation.userLanguage} />
                  <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Timezone" value={selectedLocation.userTimezone} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Timestamps</p>
                  <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Created" value={timeLabel(selectedLocation.createdAt)} />
                  <InfoRow icon={<RefreshCw className="h-3.5 w-3.5" />} label="Updated" value={timeLabel(selectedLocation.updatedAt)} />
                  <InfoRow icon={<ExternalLink className="h-3.5 w-3.5" />} label="Referrer" value={selectedLocation.referrer} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">User Agent</p>
                  <p className="text-xs text-muted-foreground break-all leading-relaxed">{selectedLocation.userAgent || "—"}</p>
                </div>
              </div>

              <div className="mt-5 rounded-lg overflow-hidden border border-border/40">
                <Map
                  userLocations={[{
                    id: selectedLocation.id,
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                    userId: "1",
                  }]}
                  center={[selectedLocation.latitude ?? 0, selectedLocation.longitude ?? 0]}
                  style={{ height: "260px", width: "100%" }}
                  zoom={14}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {[
              { id: "nickname", label: "Nickname", type: "text", key: "nickname" as keyof Location },
              { id: "ip", label: "IP Address", type: "text", key: "ip" as keyof Location },
              { id: "latitude", label: "Latitude", type: "number", key: "latitude" as keyof Location },
              { id: "longitude", label: "Longitude", type: "number", key: "longitude" as keyof Location },
            ].map(({ id, label, type, key }) => (
              <div key={id} className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={id} className="text-right text-sm">{label}</Label>
                <Input
                  id={id}
                  type={type}
                  value={(editedLocation?.[key] as string | number) ?? ""}
                  onChange={(e) =>
                    setEditedLocation((prev) => ({
                      ...prev!,
                      [key]: type === "number" ? parseFloat(e.target.value) : e.target.value,
                    }))
                  }
                  className="col-span-3 h-9"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateLocation}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
