import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Playfair_Display } from "next/font/google";
import "@/app/globals.css";
import { siteUrl } from "@/lib/content";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"]
});

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"]
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Atlas",
    template: "%s | Atlas"
  },
  description:
    "Atlas is a local-first workspace intelligence app for developers. Query repositories, inspect architecture, and keep your context private.",
  openGraph: {
    title: "Atlas",
    description:
      "Local-first workspace intelligence for developers who need speed, architectural context, and privacy by default.",
    url: siteUrl,
    siteName: "Atlas",
    images: [
      {
        url: "/img/atlas-thumbnail.png",
        width: 1200,
        height: 630,
        alt: "Atlas launch site preview"
      }
    ],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Atlas",
    description:
      "Query repositories, inspect architecture, and keep your context private with Atlas.",
    images: ["/img/atlas-thumbnail.png"]
  },
  alternates: {
    canonical: siteUrl
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
