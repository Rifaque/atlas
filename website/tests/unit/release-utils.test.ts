import { describe, expect, it } from "vitest";
import { normalizeAsset } from "@/lib/releases";
import { selectPreferredAsset } from "@/lib/os";

describe("release asset normalization", () => {
  it("normalizes github digests into sha256 strings", () => {
    const asset = normalizeAsset({
      name: "Atlas_0.9.2_x64-setup.exe",
      size: 12,
      browser_download_url: "https://example.com/file.exe",
      digest: "sha256:abcdef"
    });

    expect(asset).toEqual({
      os: "windows",
      name: "Atlas_0.9.2_x64-setup.exe",
      size: 12,
      url: "https://example.com/file.exe",
      sha256: "abcdef"
    });
  });

  it("prefers exe over msi on windows", () => {
    const selected = selectPreferredAsset("windows", [
      { os: "windows", name: "Atlas.msi", size: 1, url: "msi" },
      { os: "windows", name: "Atlas.exe", size: 1, url: "exe" }
    ]);

    expect(selected?.url).toBe("exe");
  });

  it("returns null for unknown assets", () => {
    const asset = normalizeAsset({
      name: "Atlas.zip",
      size: 12,
      browser_download_url: "https://example.com/file.zip"
    });

    expect(asset).toBeNull();
  });
});
