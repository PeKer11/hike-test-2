import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `.next` for everything a person runs by hand. The override exists for one
  // caller: the e2e suite, which builds and serves the app into `.next-e2e` so
  // it never touches the directory a running `npm run dev` owns. Next takes a
  // lockfile inside distDir -- `<distDir>/lock` while building,
  // `<distDir>/dev/lock` while serving -- so sharing one directory would mean
  // `npm run test:e2e` either refuses to start next to a dev server or
  // overwrites the build under it mid-session.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Headers the app has never sent. None of these change what a page renders —
  // they narrow what a browser is willing to do with it.
  async headers() {
    // The Supabase project URL is the one genuinely external endpoint the
    // browser talks to directly — every other upstream (Gemini, ORS, Overpass,
    // Nominatim) is proxied through this app's own /api/* routes, so 'self'
    // already covers them. Falls back to the bare host pattern so a build
    // without the env var set (this repo's own CI, which blanks it on purpose
    // for the e2e suite) still produces a syntactically valid policy rather
    // than an empty directive.
    const supabaseOrigin =
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://*.supabase.co";

    // Report-Only, deliberately, on the plan this file's own comment already
    // named: Leaflet builds marker positions with `el.style.property = value`
    // (not gated by style-src at all — that only governs <style> tags and the
    // style="" attribute) but Next inlines its own bootstrap script, which
    // does need script-src to allow it without nonce infrastructure this app
    // doesn't have yet. A policy tight enough to matter can still be wrong in
    // a way only a real browser against the real page reveals, so this reports
    // violations to the console without blocking anything until a live pass
    // confirms it's clean — see TODO.md for what to check before switching
    // this to the enforcing header.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: https://*.tile.openstreetmap.org`,
      "font-src 'self'",
      `connect-src 'self' ${supabaseOrigin}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: csp },
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
