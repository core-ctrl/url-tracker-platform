# URL Tracker Platform

A versatile URL tracker platform with features like geolocation, IP address, device info tracking, and URL shortener.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)

## Features

- **URL Tracking**: Track visits to your shared URLs
- **Geolocation**: Capture and display visitor locations on a map
- **IP Address Tracking**: Log IP addresses of visitors
- **Device Info**: Collect information about visitor devices and browsers
- **URL Shortener**: Create short, easy-to-share links
- **Admin Dashboard**: Manage and analyze tracked data
- **Real-time Updates**: View live visitor data
- **Customizable Share Links**: Create personalized tracking links

## Technologies Used

- Next.js
- React
- TypeScript
- Firebase (Realtime Database)
- Leaflet (for maps)
- Tailwind CSS
- Shadcn UI Components

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Firebase account

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/url-tracker-platform.git
   ```

2. Navigate to the project directory:
   ```
   cd url-tracker-platform
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in Firebase and optional WhatsApp values from the Firebase console (Project settings) and [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/)
   - Required for the app: all `NEXT_PUBLIC_FIREBASE_*` variables including **`NEXT_PUBLIC_FIREBASE_DATABASE_URL`** (Realtime Database URL from Firebase console)

5. Run the development server:
   ```
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

1. Create a new share link from the dashboard.
2. Customize the link with a name, description, and expiration date if desired.
3. Share the generated URL with your audience.
4. Track visits, locations, and other data in real-time from the admin dashboard.

## How data flows

- **Visitor tracking**: Opening `/track?id=<shareLinkId>` (or a short link that redirects there) runs the track page in the browser, which writes to Firebase Realtime Database under `locations/{deviceId}`. There is no separate `/api/track` HTTP endpoint.
- **Short links**: Short codes are stored under `shortUrls/{code}`. Visiting `/s/{code}` resolves the link server-side and redirects to `/track?id=…`. Unknown codes show the app **404** page.
- **Dashboard**: Share links and live locations are read/written from the client using the Firebase SDK.

## HTTP API

| Method & path | Purpose |
|---------------|---------|
| `POST /api/whatsapp` | Sends a text via Meta WhatsApp Cloud API to `RECIPIENT_PHONE_NUMBER`. Requires JSON body `{ "message": "…" }`. If `WHATSAPP_API_SECRET` is set, send header `x-internal-key` with the same value. The in-app **WhatsApp** screen uses a **server action** instead, so it still works when the secret locks the HTTP route. |

Configure `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `RECIPIENT_PHONE_NUMBER` (see `.env.example`).

## Security

Dashboard routes are not authentication-gated in this codebase; **you must configure [Firebase Realtime Database rules](docs/firebase-rules.md)** appropriately and plan **Firebase Auth** or **Admin SDK** for production. See `docs/firebase-rules.md` for guidance and a roadmap.

## Contributors

We appreciate the contributions of all our developers. Here are some of our key contributors:

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/moeidsaleem">
        <img src="https://github.com/moeidsaleem.png" width="100px;" alt="Moeid Saleem"/>
        <br />
        <sub><b>Moeid  Saleem Khan</b></sub>
      </a>
      <br />
      <sub>CTO / Full Stack Developer</sub>
    </td>
    <!-- Add more contributors as needed -->
  </tr>
</table>

<!-- Add more contributor bios as needed -->



## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
