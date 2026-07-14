import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // react-big-calendar ships mixed CJS/ESM — transpile to avoid import errors
  // in Next.js App Router (TSK-021)
  transpilePackages: ['react-big-calendar'],

  // Experimental features
  experimental: {
    // Enable server actions (stable in Next.js 15)
    serverActions: {
      allowedOrigins: ['localhost:3000'],
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
