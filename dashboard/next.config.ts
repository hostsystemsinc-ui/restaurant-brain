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
      // ── NFC puck entry points ──────────────────────────────────────────────
      // Program NFC pucks with these URLs. Guests land on the same join page
      // as QR code users; the ?src=nfc param lets us track which method drove
      // more joins in the admin analytics dashboard.
      {
        source:      "/walnut/original/puck",
        destination: "/walnut/original/join?src=nfc",
        permanent:   false,
      },
      {
        source:      "/walnut/southside/puck",
        destination: "/walnut/southside/join?src=nfc",
        permanent:   false,
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
