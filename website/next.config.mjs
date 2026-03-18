import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  experimental: {
    devtoolSegmentExplorer: false
  },
  images: {
    formats: ["image/avif", "image/webp"]
  }
};

export default nextConfig;
