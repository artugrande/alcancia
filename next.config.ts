import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@x402/fetch", "@x402/evm", "@x402/core"],
  webpack: (config) => {
    // Optional deps pulled in by wagmi's Base Account connector; not used here.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/svm/exact/client": false,
      "@x402/svm": false,
    };
    config.externals = [...(config.externals || []), "pino-pretty", "lokijs", "encoding"];
    return config;
  },
};

export default nextConfig;
