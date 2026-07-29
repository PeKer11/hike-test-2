import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The planner used to be its own route. It now renders inside /app, so
      // old bookmarks and links land on the same thing instead of a 404.
      { source: "/app/plan", destination: "/app", permanent: false },
    ];
  },
};

export default nextConfig;
