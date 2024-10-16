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
}
