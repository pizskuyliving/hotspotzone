import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { NAMA_SITUS, PATH_API, TRANSFORM_API } from "@/lib/situs";

// Gambar pratinjau saat link dibagikan (WhatsApp, X, Facebook, Telegram).
export const alt = `${NAMA_SITUS}: peta titik api, asap & kualitas udara Indonesia`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Font situs sendiri; font bawaan ImageResponse hanya Regular dan spasinya renggang.
const font = (berat: 400 | 700) =>
  readFile(join(process.cwd(), `node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-${berat}-normal.woff`));

export default async function GambarOg() {
  const [biasa, tebal] = await Promise.all([font(400), font(700)]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          fontFamily: "Jakarta",
          color: "#f1efea",
          background: "radial-gradient(circle at 80% 30%, #5a1d08 0%, #121212 60%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ width: 120, height: 120, borderRadius: 28, background: "#e8531f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="84" height="84" viewBox="0 0 64 64">
              <path d={PATH_API} fill="#fff" transform={TRANSFORM_API} />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, letterSpacing: -2 }}>
            <span>hotspotzone</span>
            <span style={{ color: "#ff6a33" }}>.id</span>
          </div>
        </div>
        <div style={{ marginTop: 44, fontSize: 46, lineHeight: 1.25 }}>Titik api, asap & kualitas udara di seluruh Indonesia</div>
        <div style={{ marginTop: 22, fontSize: 30, color: "#a19d95" }}>Data satelit NASA FIRMS · diperbarui otomatis</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Jakarta", data: biasa, weight: 400 },
        { name: "Jakarta", data: tebal, weight: 700 },
      ],
    },
  );
}
