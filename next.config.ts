import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ['192.168.18.10', '192.168.100.50', '192.168.100.59', "localhost"],
};

export default nextConfig;
