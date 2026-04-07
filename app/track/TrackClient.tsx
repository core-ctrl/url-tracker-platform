"use client";

import { useEffect, useState, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { database } from "@/lib/firebase";
import { ref, set, update, get } from "firebase/database";
import dynamic from "next/dynamic";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import { Location } from "@/components/interfaces/location.interface";
import { MapPin, AlertCircle, Loader2 } from "lucide-react";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
});

function geolocationErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return "Location permission was denied. Enable location access in your browser settings to share your position.";
    case 2:
      return "Your position could not be determined (signal unavailable).";
    case 3:
      return "Location request timed out. Try again or move to an area with a clearer signal.";
    default:
      return "Could not read your location.";
  }
}

export default function TrackClient() {
  const [coordinates, setCoordinates] = useState("Waiting for GPS…");
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<Location | undefined>();
  const [ip, setIP] = useState("");
  const [geoError, setGeoError] = useState<string | null>(null);
  const ipRef = useRef("");
  const searchParams = useSearchParams();
  const shareLinkId = searchParams.get("id");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{ ip: string }>(
          "https://api.ipify.org/?format=json"
        );
        if (!cancelled) {
          setIP(res.data.ip);
          ipRef.current = res.data.ip;
        }
      } catch {
        if (!cancelled) {
          setIP("");
          ipRef.current = "";
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!shareLinkId) {
      setIsLoading(false);
      setCoordinates("");
      setGeoError(null);
      return;
    }

    setGeoError(null);
    setIsLoading(true);
    setCoordinates("Waiting for GPS…");

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Geolocation is not supported by this browser.");
      setCoordinates("");
      setIsLoading(false);
      return;
    }

    const handleError = (err: GeolocationPositionError) => {
      setGeoError(geolocationErrorMessage(err.code));
      setCoordinates("");
      setIsLoading(false);
    };

    const saveLocationToFirebase = async (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      try {
        const deviceId =
          localStorage.getItem("deviceId") || crypto.randomUUID();
        localStorage.setItem("deviceId", deviceId);

        let clientIp = ipRef.current;
        if (!clientIp) {
          try {
            const res = await axios.get<{ ip: string }>(
              "https://api.ipify.org/?format=json"
            );
            clientIp = res.data.ip;
            ipRef.current = clientIp;
            setIP(clientIp);
          } catch {
            clientIp = "";
          }
        }

        const locationData = {
          latitude,
          longitude,
          nickname: "",
          userId: "anonymous",
          shareLinkId,
          ip: clientIp,
          deviceId,
          deviceType: /Mobi/.test(navigator.userAgent) ? "Mobile" : "Desktop",
          userAgent: navigator.userAgent,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          referrer: document.referrer,
          userLanguage: navigator.language,
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          updatedAt: Date.now(),
        };

        const locationRef = ref(database, `locations/${deviceId}`);
        const snapshot = await get(locationRef);
        const existingData = snapshot.val() as
          | { createdAt?: number }
          | null;

        if (existingData) {
          await update(locationRef, {
            ...locationData,
            createdAt: existingData.createdAt ?? Date.now(),
          });
        } else {
          await set(locationRef, {
            ...locationData,
            createdAt: Date.now(),
          });
        }

        setCoordinates(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setIsLoading(false);
        setUserLocation({ latitude, longitude });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Something went wrong";
        setGeoError(`Could not save location: ${errorMessage}`);
        setIsLoading(false);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      saveLocationToFirebase,
      handleError,
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [shareLinkId]);

  const missingLink = !shareLinkId;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border pb-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold tracking-tight">
              Live location
            </CardTitle>
            <CardDescription>
              Your position is shared with the link owner when GPS is available.
            </CardDescription>
          </div>
          <div className="rounded-md bg-muted p-2 shrink-0">
            <MapPin className="h-5 w-5 text-primary" aria-hidden />
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {missingLink && (
            <div
              className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
              <p>
                This page needs a valid tracking link. Open the full URL you
                were sent (it should include{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  ?id=…
                </code>
                ).
              </p>
            </div>
          )}

          {geoError && !missingLink && (
            <div
              className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
              <p>{geoError}</p>
            </div>
          )}

          {!missingLink && (
            <div className="flex flex-col items-stretch overflow-hidden rounded-md border border-border">
              {userLocation ? (
                <Map
                  userLocations={userLocation as Location}
                  zoom={14}
                  center={[
                    userLocation.latitude ?? 0,
                    userLocation.longitude ?? 0,
                  ]}
                />
              ) : (
                <div className="flex h-48 items-center justify-center bg-muted/40 text-muted-foreground text-sm">
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Getting your location…
                    </span>
                  ) : (
                    <span>Map appears once your position is available.</span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1 text-center text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Coordinates</span>
              <br />
              {missingLink ? "—" : coordinates}
            </p>
            {ip ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">IP</span>
                <br />
                {ip}
              </p>
            ) : null}
          </div>

          {isLoading && !missingLink && !geoError && (
            <Button variant="secondary" className="w-full" disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Working…
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
