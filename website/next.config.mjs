import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  images: {
    formats: ["image/avif", "image/webp"]
  }
};

export default nextConfig;
