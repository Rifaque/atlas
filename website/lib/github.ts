import "server-only";

import type { ReleaseAsset, ReleasePayload } from "@/lib/types";
import { normalizeAsset } from "@/lib/releases";

const OWNER = process.env.GITHUB_OWNER || "Rifaque";
const REPO = process.env.GITHUB_REPO || "atlas";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;
export const RELEASE_CACHE_SECONDS = 300;

interface GitHubReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
  digest?: string | null;
}

interface GitHubRelease {
  tag_name: string;
  published_at: string;
  html_url: string;
  body?: string | null;
  assets?: GitHubReleaseAsset[];
}

function createHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "atlas-website"
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  return headers;
}

export async function fetchLatestRelease(): Promise<ReleasePayload> {
  const response = await fetch(`${API_BASE}/releases/latest`, {
    headers: createHeaders(),
    next: { revalidate: RELEASE_CACHE_SECONDS }
  });

  if (!response.ok) {
    throw new Error(`GitHub latest release request failed with ${response.status}`);
  }

  const release = (await response.json()) as GitHubRelease;
  return {
    tag_name: release.tag_name,
    published_at: release.published_at,
    html_url: release.html_url,
    body: release.body,
    assets: (release.assets ?? []).map(normalizeAsset).filter((asset): asset is ReleaseAsset => Boolean(asset))
  };
}

export async function fetchRecentReleases(limit = 3): Promise<ReleasePayload[]> {
  const response = await fetch(`${API_BASE}/releases?per_page=${limit}`, {
    headers: createHeaders(),
    next: { revalidate: RELEASE_CACHE_SECONDS }
  });

  if (!response.ok) {
    throw new Error(`GitHub releases request failed with ${response.status}`);
  }

  const releases = (await response.json()) as GitHubRelease[];
  return releases.slice(0, limit).map((release) => ({
    tag_name: release.tag_name,
    published_at: release.published_at,
    html_url: release.html_url,
    body: release.body,
    assets: (release.assets ?? []).map(normalizeAsset).filter((asset): asset is ReleaseAsset => Boolean(asset))
  }));
}
