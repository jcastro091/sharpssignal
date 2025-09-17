// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ✅ keep this if you added it earlier to unblock lint
  eslint: { ignoreDuringBuilds: true },

  // ❌ REMOVE anything like this:
  // output: 'export',
  // distDir: 'out',
}

export default nextConfig
