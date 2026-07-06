import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@logger/db", "@logger/shared"]
};

export default nextConfig;
