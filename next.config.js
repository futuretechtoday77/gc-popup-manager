/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep builds within small CI/container memory envelopes.
  experimental: { cpus: 1 },
};
module.exports = nextConfig;
