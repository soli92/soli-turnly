import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Experimental features
  experimental: {
    // Enable server actions (stable in Next.js 15)
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },

  // Image optimization
  images: {
    remotePatterns: [],
  },

  // TypeScript and ESLint config
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
