/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The imported console has its own gradual ESLint migration; production
  // correctness remains enforced by the repository-wide TypeScript build.
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN ||
      (process.env.NODE_ENV === "production"
        ? "https://proto2-80qe.onrender.com"
        : "http://localhost:8000");
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
