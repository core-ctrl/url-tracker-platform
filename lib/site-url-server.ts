import { headers } from "next/headers";

/**
 * Absolute origin for the current request (scheme + host + port).
 * Use only in Server Components, Route Handlers, or generateMetadata.
 */
export function getSiteOriginFromHeaders(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (fromEnv) {
      try {
        return new URL(fromEnv).origin;
      } catch {
        /* fall through */
      }
    }
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    return "http://localhost:3000";
  }

  const protoHeader = h.get("x-forwarded-proto");
  const proto =
    protoHeader?.split(",")[0]?.trim() ||
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");

  return `${proto}://${host}`;
}
