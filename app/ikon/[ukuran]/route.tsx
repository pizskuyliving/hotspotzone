import { ImageResponse } from "next/og";
import { PATH_API, TRANSFORM_API } from "@/lib/situs";

// Ikon PNG untuk manifest PWA (Android butuh 192 dan 512).
// Api ditaruh di tengah dengan ruang aman, jadi bisa dipakai sebagai ikon "maskable".
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ ukuran: "192" }, { ukuran: "512" }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ ukuran: string }> }) {
  const sisi = Number((await params).ukuran);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#e8531f" }}>
        <svg width={sisi * 0.6} height={sisi * 0.6} viewBox="0 0 64 64">
          <path d={PATH_API} fill="#fff" transform={TRANSFORM_API} />
        </svg>
      </div>
    ),
    { width: sisi, height: sisi },
  );
}
