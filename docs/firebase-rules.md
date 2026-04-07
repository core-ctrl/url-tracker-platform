# Firebase Realtime Database rules

The app reads and writes **Firebase Realtime Database** directly from the browser (dashboard and public `/track` page). **Security is entirely enforced by your RTDB rules** until you add Firebase Auth or a server layer with the Admin SDK.

## What to protect

| Path | Written by | Read by |
|------|------------|---------|
| `locations/{deviceId}` | `/track` (visitors) | Dashboard |
| `shareLinks/{id}` | Dashboard | Dashboard |
| `shortUrls/{code}` | Dashboard (short links) | `/s/[code]` (server component uses client SDK in practice via `lib/firebase` on server – same config) |

## Principles

1. **Do not leave `.read` / `.write` as `true` in production.**
2. **Public track page** must be able to create/update **only** its own device row. Using `deviceId` as the key helps, but a malicious client can still guess or overwrite keys unless rules constrain writes (e.g. validate payload shape, rate limits are not available in rules – consider Cloud Functions for heavy abuse protection).
3. **Dashboard** today has **no login** in the app. Any visitor who can load `/share-links` can manage links if rules allow it. For production, prefer **Firebase Authentication** and rules like `auth != null` for `shareLinks` and `shortUrls`, and tighter rules for `locations` (e.g. admin-only read, append-only from track with validation).

## Example starter rules (tighten before production)

```json
{
  "rules": {
    "locations": {
      "$deviceId": {
        ".read": true,
        ".write": true
      }
    },
    "shareLinks": {
      ".read": true,
      ".write": true
    },
    "shortUrls": {
      ".read": true,
      ".write": true
    }
  }
}
```

The above is **equivalent to open access** for those trees – useful only for local development. Replace with:

- **Authenticated admins** for `shareLinks` and `shortUrls`.
- **Validated writes** for `locations` (e.g. require `newData.hasChildren(['latitude', 'longitude'])` and numeric ranges).

See the official guide: [Realtime Database security rules](https://firebase.google.com/docs/database/security).

## Next step: Firebase Auth + Admin SDK

- **Firebase Auth** (email/password, Google, etc.) for dashboard routes; gate `(dashboard)/*` in the app and set RTDB rules to `auth != null` for admin paths.
- **Firebase Admin SDK** in **Next.js Route Handlers** or **Server Actions** for sensitive operations (listing all locations, deleting data) so the client never holds broad write access.

Until then, treat your dashboard URLs and Firebase project as sensitive.
