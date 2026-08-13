/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    // Vercel builds only the marketing app from this repository root today.
    // Until the console is assigned its own Vercel project/root directory,
    // send production demo traffic to the already deployed console instead
    // of attempting to proxy to localhost and returning a dead route.
    if (process.env.NODE_ENV === "production" && !process.env.CONSOLE_ORIGIN) {
      return [
        {
          source: "/console/:path*",
          destination: "https://proto2-mocha.vercel.app/:path*",
          permanent: false,
        },
      ];
    }

    return [];
  },
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
