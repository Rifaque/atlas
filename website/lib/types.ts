export type OperatingSystem = "windows" | "mac" | "linux";

export interface ReleaseAsset {
  os: OperatingSystem;
  name: string;
  url: string;
  size: number;
  sha256?: string;
}

export interface ReleasePayload {
  tag_name: string;
  published_at: string;
  html_url?: string;
  body?: string | null;
  assets: ReleaseAsset[];
}

export interface ScreenshotItem {
  id: string;
  title: string;
  caption: string;
  image: string;
  alt: string;
}

export interface FeatureItem {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  align: "left" | "right";
}
