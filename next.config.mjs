/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
  // better-sqlite3 is a native Node addon — keep it external
  serverExternalPackages: ["better-sqlite3"],
  // Next 14 alias
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
