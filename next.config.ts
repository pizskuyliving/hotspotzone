import type { NextConfig } from "next";
import { URL_SITUS } from "./lib/situs";

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
    return [
      { source: "/:path*", headers: HEADER_KEAMANAN },
      // Vercel memasang Access-Control-Allow-Origin: * di semua respons. Data API
      // hanya untuk situs ini; situs lain tidak boleh memakainya dari browser
      // pengunjung mereka (bandwidth kita yang terpakai). Permintaan dari domain
      // sendiri tidak memerlukan CORS, jadi tidak terpengaruh.
      { source: "/api/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: URL_SITUS }] },
      // Service worker harus selalu dicek ulang agar versi baru cepat terpasang.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
