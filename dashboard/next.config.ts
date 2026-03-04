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
};

export default nextConfig;
