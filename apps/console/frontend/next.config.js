/** @type {import('next').NextConfig} */
const nextConfig = {
  // Multi-zone mount used by the unified Axeris marketing repository.
  // Leave unset when running this package as a standalone console.
  basePath: process.env.AXERIS_CONSOLE_BASE_PATH || "",
  outputFileTracingRoot: __dirname,
  // The console predates the marketing site's stricter repository-level
  // ESLint profile. TypeScript remains enforced independently via `tsc`.
  eslint: { ignoreDuringBuilds: true },
  // Exact tunnel hostnames only — wildcarding *.loca.lt / *.trycloudflare.com
  // would trust every subdomain of the free tunnel services (anyone can mint one).
  allowedDevOrigins: ["axeris-proto.loca.lt"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace("/api/v1", "")
      : "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
