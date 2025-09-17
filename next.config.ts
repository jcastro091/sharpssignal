/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // 🚫 Don’t block production builds on ESLint errors
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
