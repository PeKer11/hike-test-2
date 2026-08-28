import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headers the app has never sent. None of these change what a page renders —
  // they narrow what a browser is willing to do with it.
  //
  // No Content-Security-Policy here, deliberately. A CSP is the one header on
  // this list that CAN break the app: Leaflet builds style attributes at
  // runtime and Next inlines its own bootstrap script, so a policy tight enough
  // to be worth having needs a report-only rollout against the real page first.
  // Adding one blind would either break the map or be so loose it says nothing.
  // Tracked as still-open in TODO.md rather than guessed at here.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Vercel serves this over HTTPS already; this is what stops a browser
          // from ever trying the plaintext version again.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Stops a response being re-interpreted as a type it did not declare.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Nothing here is meant to be embedded anywhere, and the planner is
          // behind a session — clickjacking it is the attack this closes.
          { key: "X-Frame-Options", value: "DENY" },
          // A walk plan's URL can carry where somebody is standing. Send the
          // origin to other sites, never the path.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Geolocation is the one capability this app actually asks for, so it
          // stays open to same-origin and closed to embedded frames.
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), camera=(), microphone=(), payment=()",
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // The planner used to be its own route. It now renders inside /app, so
      // old bookmarks and links land on the same thing instead of a 404.
      { source: "/app/plan", destination: "/app", permanent: false },
    ];
  },
};

export default nextConfig;
