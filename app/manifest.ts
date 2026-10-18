import type { MetadataRoute } from "next";
import { DESKRIPSI_SITUS, NAMA_SITUS } from "@/lib/situs";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${NAMA_SITUS} · Titik Api & Kualitas Udara`,
    short_name: NAMA_SITUS,
    description: DESKRIPSI_SITUS,
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#e8531f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/ikon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/ikon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/ikon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
