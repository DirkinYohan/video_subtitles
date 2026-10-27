import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // La app se abre por http://127.0.0.1:3000 y por http://localhost:3000.
  // Sin esto, Next bloquea sus recursos de desarrollo en el origen "cruzado"
  // (HMR, recarga en caliente) y la pagina puede quedarse sin actualizarse.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    proxyClientMaxBodySize: "2048mb",
    // El proxy corta a los 30 s por defecto. Subir un vídeo (recibirlo,
    // medirlo con ffprobe y guardarlo en Storage) tarda más: la API terminaba
    // con 200 pero el navegador recibía un 500 («socket hang up»).
    proxyTimeout: 15 * 60 * 1000,
  },
  async rewrites() {
    const api = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
