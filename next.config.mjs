/** @type {import('next').NextConfig} */

// Next App Router emits inline scripts (flight/hydration). A script-src hash
// disables 'unsafe-inline' per CSP2 — so we cannot hash the theme snippet
// without Next nonce plumbing. Keep frame/nosniff/referrer + a practical CSP.
// 'unsafe-eval' is only needed for webpack in `next dev` — never ship it to prod.
const isProd = process.env.NODE_ENV === "production";
const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const ContentSecurityPolicy = [
  "default-src 'self'",
  scriptSrc,
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
    outputFileTracingIncludes: {
      "/**": ["./node_modules/sql.js/dist/sql-wasm.wasm"],
    },
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
  // sql.js loads its WASM via require.resolve at runtime — keep it external so
  // webpack doesn't rewrite that path; the wasm is traced into deploys above.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("sql.js");
      }
    }
    return config;
  },
};

export default nextConfig;
