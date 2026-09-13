export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://atlas.rifaque.dev";

export const githubUrl = "https://github.com/Rifaque/atlas";
export const releaseVersion = "1.0.2";
export const installerFilename = `Atlas_${releaseVersion}_x64-setup.exe`;
export const releaseUrl =
  process.env.NEXT_PUBLIC_ATLAS_RELEASE_URL || `https://github.com/Rifaque/atlas/releases/tag/v${releaseVersion}`;
export const installerSha256 = "9F3E67551230A1840EBA7F8E69131169A25D942F9DD7EDAB574BE32E1F354975";
