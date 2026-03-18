import type { OperatingSystem, ReleaseAsset } from "@/lib/types";

interface GitHubReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
  digest?: string | null;
}

function inferOs(name: string): OperatingSystem | null {
  const lower = name.toLowerCase();

  if (lower.includes(".exe") || lower.includes(".msi") || lower.includes("win")) return "windows";
  if (lower.includes(".dmg") || lower.includes(".pkg") || lower.includes("darwin") || lower.includes("mac")) return "mac";
  if (lower.includes(".appimage") || lower.includes(".deb") || lower.includes(".rpm") || lower.includes("linux")) return "linux";
  return null;
}

function normalizeSha(digest?: string | null): string | undefined {
  if (!digest) return undefined;
  return digest.startsWith("sha256:") ? digest.slice(7) : digest;
}

export function normalizeAsset(asset: GitHubReleaseAsset): ReleaseAsset | null {
  const os = inferOs(asset.name);
  if (!os) return null;

  return {
    os,
    name: asset.name,
    url: asset.browser_download_url,
    size: asset.size,
    sha256: normalizeSha(asset.digest)
  };
}
