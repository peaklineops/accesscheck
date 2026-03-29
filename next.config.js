/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Prevent Next.js from bundling heavy server-side packages — load from node_modules at runtime
    serverComponentsExternalPackages: ['jsdom', 'axe-core', 'canvas'],
  },
};

module.exports = nextConfig;
