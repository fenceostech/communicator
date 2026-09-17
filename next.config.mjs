/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Serve the static console + blueprint (public/*.html) at clean paths.
    return [
      { source: '/', destination: '/index.html' },
      { source: '/blueprint', destination: '/blueprint.html' },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
