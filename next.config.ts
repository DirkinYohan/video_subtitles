import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // La app se abre por http://127.0.0.1:3000 y por http://localhost:3000.
  // Sin esto, Next bloquea sus recursos de desarrollo en el origen "cruzado"
  // (HMR, recarga en caliente) y la pagina puede quedarse sin actualizarse.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    proxyClientMaxBodySize: "2048mb",
  },
  async rewrites() {
    const api = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
