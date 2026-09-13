export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://atlas.rifaque.dev";

export const githubUrl = "https://github.com/Rifaque/atlas";
export const releaseVersion = "1.0.1";
export const installerFilename = `Atlas_${releaseVersion}_x64-setup.exe`;
export const releaseUrl =
  process.env.NEXT_PUBLIC_ATLAS_RELEASE_URL || `https://github.com/Rifaque/atlas/releases/tag/v${releaseVersion}`;
export const installerSha256 = "2C1C4F511895624400F437B4117ED4D532244D06828E4F10875C8F8324BD18CC";
