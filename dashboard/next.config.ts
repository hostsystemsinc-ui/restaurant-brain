import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // www → root permanent redirect
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.hostplatform.net" }],
        destination: "https://hostplatform.net/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      // Proxy all backend API calls through the Next.js server to avoid CORS
      {
        source: "/api/brain/:path*",
        destination: "https://restaurant-brain-production.up.railway.app/:path*",
      },
    ];
  },
};

export default nextConfig;
