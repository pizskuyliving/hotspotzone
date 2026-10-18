import type { NextConfig } from "next";

// HSTS sudah dipasang otomatis oleh Vercel.
const HEADER_KEAMANAN = [
  // Situs tidak boleh dibingkai situs lain (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lokasi dipakai tombol "lokasi saya" di peta; fitur lain tidak perlu.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: HEADER_KEAMANAN }];
  },
};

export default nextConfig;
