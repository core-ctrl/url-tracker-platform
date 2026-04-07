export interface LocationHistoryEntry {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    locationSource: 'gps' | 'ip';
    ts: number; // unix ms
}

// Location Interface
export interface Location {
    id?: string;
    latitude?: number | null;
    longitude?: number | null;
    nickname?: string | null;
    userId?: string | null;
    shareLinkId?: string | null;
    ip?: string | null;
    deviceId?: string | null;
    deviceType?: string;
    userAgent?: string;
    screenWidth?: number;
    screenHeight?: number;
    referrer?: string;
    userLanguage?: string;
    userTimezone?: string;
    updatedAt?: number;
    createdAt?: number;

    // Location source
    locationSource?: 'gps' | 'ip';

    // IP geolocation (populated when locationSource === 'ip', or as enrichment)
    ipCity?: string | null;
    ipRegion?: string | null;
    ipCountry?: string | null;
    ipIsp?: string | null;
    ipAccuracy?: string | null; // e.g. "city-level"

    // Movement history — each entry is a timestamped position update
    history?: LocationHistoryEntry[];

    // Device fingerprint
    batteryLevel?: number | null;       // 0–100
    batteryCharging?: boolean | null;
    networkType?: string | null;        // "4g" | "3g" | "2g" | "slow-2g"
    networkDownlink?: number | null;    // Mbps
    networkRtt?: number | null;         // ms
    hardwareConcurrency?: number | null; // CPU cores
    deviceMemory?: number | null;       // GB (approximate)
    maxTouchPoints?: number | null;
    platform?: string | null;
}
