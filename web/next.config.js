/** @type {import('next').NextConfig} */
const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: '/:path*', headers: [{ key: 'Connection', value: 'close' }] },
    ];
  },
  async rewrites() {
    // /api/* 全部转发到后端（部署后 = https://api.example.com，本地 = localhost:3001）
    return [
      { source: '/api/media/:path*', destination: '/api/media/:path*' },
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;
