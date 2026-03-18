import type { Metadata } from "next";
import { ChangelogAccordion } from "@/app/components/ChangelogAccordion";
import { FeaturePanel } from "@/app/components/FeaturePanel";
import { Footer } from "@/app/components/Footer";
import { Hero } from "@/app/components/Hero";
import { NavBar } from "@/app/components/NavBar";
import { ScreenshotsCarousel } from "@/app/components/ScreenshotsCarousel";
import { SpecsSection } from "@/app/components/SpecsSection";
import { StickyDownloadCTA } from "@/app/components/StickyDownloadCTA";
import { featureItems, siteUrl } from "@/lib/content";
import { fetchLatestRelease, fetchRecentReleases } from "@/lib/github";
import type { ReleasePayload } from "@/lib/types";

export const metadata: Metadata = {
  title: "Atlas — Local AI Workspace for Developers"
};

const fallbackRelease: ReleasePayload = {
  tag_name: "Latest release",
  published_at: new Date("2026-03-06T13:17:17Z").toISOString(),
  html_url: "https://github.com/Rifaque/atlas/releases",
  body: "Release metadata is temporarily unavailable. Visit GitHub releases for the latest installers.",
  assets: []
};

export default async function HomePage() {
  const [release, releases] = await Promise.all([
    fetchLatestRelease().catch(() => fallbackRelease),
    fetchRecentReleases(3).catch(() => [fallbackRelease])
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Atlas",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Windows, Linux, macOS",
    description:
      "Atlas is a local-first workspace intelligence app for developers. Query repositories, inspect architecture, and keep your context private.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD"
    },
    url: siteUrl
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <NavBar />
      <main>
        <Hero />
        <section id="features" className="section-shell py-24 sm:py-32">
          <div className="mb-10 max-w-3xl">
            <span className="eyebrow">Why Atlas</span>
            <h2 className="font-display text-4xl leading-tight text-bone sm:text-5xl">
              Product storytelling built around the actual system: local indexing, real repo awareness, and controlled agentic power.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-mist">
              The page now moves directly from Atlas&apos;s core system strengths into a richer product gallery, so the visual preview lands harder and earlier.
            </p>
          </div>
          <div className="space-y-8">
            {featureItems.map((feature) => (
              <FeaturePanel key={feature.id} feature={feature} />
            ))}
          </div>
        </section>
        <ScreenshotsCarousel />
        <SpecsSection release={release} />
        <ChangelogAccordion releases={releases} />
      </main>
      <Footer />
      <StickyDownloadCTA release={release} />
    </>
  );
}
