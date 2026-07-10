/** @type {import('next').NextConfig} */

// Next App Router emits inline scripts (flight/hydration). A script-src hash
// disables 'unsafe-inline' per CSP2 — so we cannot hash the theme snippet
// without Next nonce plumbing. Keep frame/nosniff/referrer + a practical CSP.
const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Load-bearing: starts the background warmer. Pin Next consciously —
    // an upgrade that changes instrumentation semantics silently kills warming.
    instrumentationHook: true,
  },
  // Surface runtime overrides (Playwright sets PULSEWIRE_DB_PATH on webServer).
  env: {
    PULSEWIRE_DB_PATH: process.env.PULSEWIRE_DB_PATH || "",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  // better-sqlite3 is a native Node addon — keep it external (Next 14 webpack)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("better-sqlite3");
      }
    }
    return config;
  },
};

export default nextConfig;
