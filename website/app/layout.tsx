import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "@/app/globals.css";
import { siteUrl } from "@/lib/content";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"]
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Atlas — Workspace intelligence with evidence",
    template: "%s | Atlas"
  },
  description:
    "Atlas indexes one local workspace, supports grounded Ask and Find workflows, and makes cloud transfers explicit and opt-in.",
  openGraph: {
    title: "Atlas — Understand your workspace. From your workspace.",
    description: "Grounded workspace questions, direct source discovery, and inspectable evidence.",
    url: siteUrl,
    siteName: "Atlas",
    images: [{ url: "/brand/atlas-icon.png", width: 512, height: 512, alt: "Atlas icon" }],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Atlas — Workspace intelligence with evidence",
    description: "Ask, Find, and inspect grounded workspace evidence with Atlas.",
    images: ["/brand/atlas-icon.png"]
  },
  alternates: { canonical: siteUrl }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${sans.variable} ${mono.variable}`}><body>{children}</body></html>;
}
