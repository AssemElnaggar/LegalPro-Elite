import type { NextConfig } from "next";
import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  webpack: (config) => {
    config.resolve.plugins = config.resolve.plugins || [];
    config.resolve.plugins.push(
      new TsconfigPathsPlugin({
        configFile: "./tsconfig.json",
      })
    );
    return config;
  },
  turbopack: {},
};

export default nextConfig;
