export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://atlas.rifaque.dev";

export const githubUrl = "https://github.com/Rifaque/atlas";
export const releaseVersion = "1.0.3";
export const installerFilename = `Atlas_${releaseVersion}_x64-setup.exe`;
export const releaseUrl =
  process.env.NEXT_PUBLIC_ATLAS_RELEASE_URL || `https://github.com/Rifaque/atlas/releases/tag/v${releaseVersion}`;
export const installerSha256 = "16D953C943BF55F18D5A73F9C8C842B94203652CD2857E61F3883E51D50E7D23";
