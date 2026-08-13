/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async rewrites() {
    const consoleOrigin = process.env.CONSOLE_ORIGIN || "http://localhost:3001";
    const apiOrigin = process.env.API_ORIGIN || "http://localhost:8000";
    return [
      {
        source: "/console/:path*",
        destination: `${consoleOrigin}/console/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
