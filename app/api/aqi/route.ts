import { sedangBuild } from "@/lib/build";
import { BBOX_INDONESIA } from "@/lib/firms";
import type { ResponsAqi, StasiunAqi } from "@/lib/tipe";

// Stasiun darat dari WAQI (aqicn.org). Cache singkat hanya untuk menghemat
// kuota; syarat WAQI melarang menyimpan atau mengarsipkan datanya.
export const revalidate = 600;
// Tetap ISR walau fetch ke sumber memakai no-store.
export const dynamic = "force-static";

type WaqiStasiun = { lat: number; lon: number; uid: number; aqi: string; station?: { name?: string; time?: string } };

export async function GET() {
  const token = process.env.WAQI_TOKEN;
  const kosong: ResponsAqi = { aktif: false, diperbarui: new Date().toISOString(), stasiun: [] };
  if (!token) return Response.json(kosong);

  const [barat, selatan, timur, utara] = BBOX_INDONESIA.split(",");
  try {
    const res = await fetch(
      `https://api.waqi.info/v2/map/bounds?latlng=${selatan},${barat},${utara},${timur}&networks=all&token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    const json = (await res.json()) as { status: string; data: WaqiStasiun[] | string };
    if (json.status !== "ok" || !Array.isArray(json.data)) throw new Error(String(json.data));
    const stasiun: StasiunAqi[] = json.data
      .map((s) => ({
        uid: s.uid,
        nama: s.station?.name ?? "Stasiun",
        lat: s.lat,
        lon: s.lon,
        aqi: Number(s.aqi),
        waktu: s.station?.time ?? null,
      }))
      .filter((s) => Number.isFinite(s.aqi));
    return Response.json({ aktif: true, diperbarui: new Date().toISOString(), stasiun } satisfies ResponsAqi);
  } catch (e) {
    console.error("WAQI gagal", e);
    // Biarkan ISR menyajikan data terakhir yang berhasil.
    if (!sedangBuild()) throw e;
    return Response.json(kosong);
  }
}
