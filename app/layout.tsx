import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-utama", display: "swap" });

export const metadata: Metadata = {
  title: "hotspotzone.id · Titik Api, Asap & Kualitas Udara Indonesia",
  description:
    "Peta titik api (hotspot) dari satelit NASA, sebaran asap, dan indeks kualitas udara (AQI) di seluruh Indonesia, diperbarui otomatis.",
  applicationName: "hotspotzone.id",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ee" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
