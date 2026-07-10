/** @type {import('next').NextConfig} */

// Theme boot script in app/layout.tsx — keep in sync if the snippet changes.
const THEME_SCRIPT_HASH = "sha256-cfy4Tw1A5E0JMpX07hqNHa2UNzTD7c96OKfNwEsCas4=";

const ContentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' '${THEME_SCRIPT_HASH}'`,
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
