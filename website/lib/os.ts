import type { OperatingSystem, ReleaseAsset } from "@/lib/types";

export function detectClientOs(): OperatingSystem | null {
  if (typeof window === "undefined") return null;
  const platform = window.navigator.userAgent.toLowerCase();

  if (platform.includes("win")) return "windows";
  if (platform.includes("mac") || platform.includes("darwin")) return "mac";
  if (platform.includes("linux") || platform.includes("x11")) return "linux";
  return null;
}

export function selectPreferredAsset(os: OperatingSystem, assets: ReleaseAsset[]): ReleaseAsset | null {
  const candidates = assets.filter((asset) => asset.os === os);
  if (candidates.length === 0) return null;

  const preference =
    os === "windows"
      ? [".exe", ".msi"]
      : os === "mac"
        ? [".dmg", ".pkg"]
        : [".appimage", ".deb", ".rpm"];

  return [...candidates].sort((left, right) => {
    const leftIndex = preference.findIndex((extension) => left.name.toLowerCase().endsWith(extension));
    const rightIndex = preference.findIndex((extension) => right.name.toLowerCase().endsWith(extension));
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  })[0] ?? null;
}
