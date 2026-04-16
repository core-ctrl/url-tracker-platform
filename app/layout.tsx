import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster"
import { Montserrat } from 'next/font/google';
import { getSiteOriginFromHeaders } from "@/lib/site-url-server";

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const origin = getSiteOriginFromHeaders();
  const metadataBase = new URL(origin.endsWith("/") ? origin.slice(0, -1) : origin);
  const brand =
    process.env.NEXT_PUBLIC_APP_NAME?.trim() || metadataBase.hostname;

  return {
    metadataBase,
    title: {
      default: `${brand} — Location tracker`,
      template: `%s | ${brand}`,
    },
    description: "Track your location and share it with friends and family.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} font-sans antialiased`}>
        <Toaster />

        {children}
      </body>
    </html>
  );
}
