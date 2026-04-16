export type TrackLocale = "en" | "de";

export function normalizeTrackLocale(
  value: string | null | undefined
): TrackLocale {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "de" || v === "de-de" || v === "german") return "de";
  return "en";
}

type Messages = {
  yourStory: string;
  sponsored: string;
  likesLine: string;
  viewAllComments: string;
  hoursAgo: string;
  addCommentPlaceholder: string;
  post: string;
  defaultCaption: string;
  profileAria: string;
};

export type TrackMessageKey = keyof Messages;

const EN: Messages = {
  yourStory: "Your story",
  sponsored: "Sponsored",
  likesLine: "{count} likes",
  viewAllComments: "View all {n} comments",
  hoursAgo: "{n} hours ago",
  addCommentPlaceholder: "Add a comment…",
  post: "Post",
  defaultCaption: "✨ Check this out!",
  profileAria: "Profile",
};

const DE: Messages = {
  yourStory: "Deine Story",
  sponsored: "Anzeige",
  likesLine: "{count} Gefällt mir",
  viewAllComments: "Alle {n} Kommentare ansehen",
  hoursAgo: "vor {n} Std.",
  addCommentPlaceholder: "Kommentar hinzufügen…",
  post: "Posten",
  defaultCaption: "✨ Schau dir das an!",
  profileAria: "Profil",
};

const TABLES: Record<TrackLocale, Messages> = {
  en: EN,
  de: DE,
};

export function trackT(
  locale: TrackLocale,
  key: TrackMessageKey,
  vars?: Record<string, string | number>
): string {
  let s: string = TABLES[locale][key] ?? TABLES.en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      const token = `{${k}}`;
      s = s.split(token).join(String(v));
    }
  }
  return s;
}

export function numberLocaleForTrack(locale: TrackLocale): string {
  return locale === "de" ? "de-DE" : "en-US";
}
