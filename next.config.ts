import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Required for FFmpeg WASM SharedArrayBuffer
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
}

export default nextConfig;
