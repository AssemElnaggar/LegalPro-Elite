import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // إضافة turbopack config فارغ لتجنب الأخطاء
  turbopack: {},
};

export default nextConfig;
