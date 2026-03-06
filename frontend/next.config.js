/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained build for Docker deployment
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
}

module.exports = nextConfig
