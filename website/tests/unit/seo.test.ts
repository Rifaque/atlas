import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  IBM_Plex_Sans: () => ({ variable: "font-sans" }),
  IBM_Plex_Mono: () => ({ variable: "font-mono" })
}));

import { metadata } from "@/app/layout";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { siteUrl } from "@/lib/content";

const canonicalOrigin = "https://atlas.rsxdevelops.dev";

describe("Atlas website SEO metadata", () => {
  it("uses the current canonical domain", () => {
    expect(siteUrl).toBe(canonicalOrigin);
    expect(metadata.metadataBase?.toString()).toBe(`${canonicalOrigin}/`);
    expect(metadata.alternates?.canonical).toBe(canonicalOrigin);
    expect(metadata.openGraph?.url).toBe(canonicalOrigin);
  });

  it("keeps robots.txt and the sitemap on the canonical origin", () => {
    expect(robots().sitemap).toBe(`${canonicalOrigin}/sitemap.xml`);
    expect(sitemap().map((entry) => entry.url)).toEqual([canonicalOrigin]);
  });
});
