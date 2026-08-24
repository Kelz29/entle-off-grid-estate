import type { NextConfig } from "next";
import path from "path";

const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  // Parent lockfiles (e.g. ~/package-lock.json) make Turbopack pick the wrong
  // workspace root. Pin root so this project's node_modules resolve correctly.
  turbopack: {
    root: projectRoot,
  },
  // Avoid bundling; load from node_modules at runtime.
  serverExternalPackages: ["nodemailer"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "grainy-gradients.vercel.app",
      },
    ],
  },
};

export default nextConfig;
