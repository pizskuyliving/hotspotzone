import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { DESKRIPSI_SITUS, JUDUL_SITUS, NAMA_SITUS, URL_SITUS } from "@/lib/situs";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-utama", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(URL_SITUS),
  title: JUDUL_SITUS,
  description: DESKRIPSI_SITUS,
  applicationName: NAMA_SITUS,
  keywords: ["titik api", "hotspot", "karhutla", "kebakaran hutan", "kabut asap", "kualitas udara", "AQI", "Indonesia"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "id_ID", url: "/", siteName: NAMA_SITUS, title: JUDUL_SITUS, description: DESKRIPSI_SITUS },
  twitter: { card: "summary_large_image", title: JUDUL_SITUS, description: DESKRIPSI_SITUS },
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
