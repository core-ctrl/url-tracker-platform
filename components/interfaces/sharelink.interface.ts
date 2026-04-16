// ShareLink Interface
export interface ShareLink {
    id?: string;
    name?: string;
    /** Shown on the track page stories row (e.g. Instagram handle). Falls back to name, then "Your story". */
    username?: string | null;
    description?: string;
    title?: string;
    imageUrl?: string;
    /** Track / Instagram-style page copy: English or German */
    locale?: "en" | "de" | string | null;
    createdAt?: number;
    updatedAt?: number;
}