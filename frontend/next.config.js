const { withAmplifyHosting } = require('@aws-amplify/adapter-nextjs/next-config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'main.d36mzlejelhubs.amplifyapp.com',
      ],
    },
  },
}

module.exports = withAmplifyHosting(nextConfig);