/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 强制关掉 dev keep-alive，消除 Chrome 的 net::ERR_EMPTY_RESPONSE。
  async headers() {
    return [
      { source: '/:path*', headers: [{ key: 'Connection', value: 'close' }] },
    ];
  },
  async rewrites() {
    const target = (process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:3200') + '/:path*';
    return [
      // /api/media/* 由 app/api/media/route.ts 自身处理（同源代理七牛，绕过 PNA），
      // 不要再被 rewrite 转发到 3200。
      { source: '/api/media/:path*', destination: '/api/media/:path*' },
      // 其它 /api/* 全部转发到 Nest 后端
      {
        source: '/api/:path*',
        destination: target.replace(':path*', 'api/:path*'),
      },
    ];
  },
};
export default nextConfig;