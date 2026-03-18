import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "jest-axe";
import { ChangelogAccordion } from "@/app/components/ChangelogAccordion";
import { Footer } from "@/app/components/Footer";
import { NavBar } from "@/app/components/NavBar";
import { ScreenshotsCarousel } from "@/app/components/ScreenshotsCarousel";
import { SpecsSection } from "@/app/components/SpecsSection";
import { StickyDownloadCTA } from "@/app/components/StickyDownloadCTA";
import type { ReleasePayload } from "@/lib/types";

const releaseFixture: ReleasePayload = {
  tag_name: "v0.9.2",
  published_at: "2026-03-06T13:17:17Z",
  html_url: "https://github.com/Rifaque/atlas/releases/tag/v0.9.2",
  body: null,
  assets: [
    {
      os: "windows",
      name: "Atlas_0.9.2_x64-setup.exe",
      url: "https://example.com/Atlas.exe",
      size: 26127461,
      sha256: "abcdef1234567890"
    },
    {
      os: "linux",
      name: "Atlas_0.9.2_amd64.AppImage",
      url: "https://example.com/Atlas.AppImage",
      size: 124217848,
      sha256: "fedcba0987654321"
    }
  ]
};

describe("homepage accessibility", () => {
  it("renders the launch page sections without obvious axe violations", async () => {
    const view = render(
      <div>
        <NavBar />
        <ScreenshotsCarousel />
        <SpecsSection release={releaseFixture} />
        <ChangelogAccordion releases={[releaseFixture]} />
        <Footer />
        <StickyDownloadCTA release={releaseFixture} />
      </div>
    );

    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });
});
