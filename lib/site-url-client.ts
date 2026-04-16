/**
 * Absolute origin (scheme + host + port). Safe in client components.
 * Prefer window.location.origin when available; falls back to NEXT_PUBLIC_APP_URL.
 */
export function getPublicOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      return "";
    }
  }
  return "";
}

const SHORT_CODE_RE = /\/s\/([^/?#]+)/;

/**
 * Rebuilds a stored `/s/{code}` URL using the current public origin.
 * Use this for display/copy so links saved under an old host (e.g. a Vercel default domain)
 * still match the site you are on (custom domain, preview URL, localhost).
 */
export function resolveShortUrlToPublicOrigin(storedShortUrl: string): string {
  if (!storedShortUrl?.trim()) return "";
  const origin = getPublicOrigin();
  const m = storedShortUrl.match(SHORT_CODE_RE);
  if (m && origin) {
    return `${origin}/s/${m[1]}`;
  }
  return storedShortUrl.trim();
}
