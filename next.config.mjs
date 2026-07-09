/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
  // Surface runtime overrides (Playwright sets PULSEWIRE_DB_PATH on webServer).
  env: {
    PULSEWIRE_DB_PATH: process.env.PULSEWIRE_DB_PATH || "",
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
