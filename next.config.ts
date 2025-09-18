// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true }, // optional
  // ❌ no `output: 'export'`
}

export default nextConfig
