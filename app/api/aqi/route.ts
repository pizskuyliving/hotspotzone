import { sedangBuild } from "@/lib/build";
import type { ResponsAqi, StasiunAqi } from "@/lib/tipe";
import { ambilPetaWaqi } from "@/lib/waqi";
import { cariProvinsi } from "@/lib/provinsi";
import { zonaWaktu } from "@/lib/zona";

// Stasiun darat dari WAQI (aqicn.org). Cache singkat hanya untuk menghemat
// kuota; syarat WAQI melarang menyimpan atau mengarsipkan datanya.
export const revalidate = 600;
// Tetap ISR walau fetch ke sumber memakai no-store.
export const dynamic = "force-static";

export async function GET() {
  const token = process.env.WAQI_TOKEN;
  const kosong: ResponsAqi = { aktif: false, diperbarui: new Date().toISOString(), stasiun: [] };
  if (!token) return Response.json(kosong);

  try {
    const stasiun: StasiunAqi[] = (await ambilPetaWaqi(token))
      .map((s) => ({
        uid: s.uid,
        nama: s.station?.name ?? "Stasiun",
        lat: s.lat,
        lon: s.lon,
        aqi: Number(s.aqi),
        waktu: s.station?.time ?? null,
        // Dihitung di server: data provinsi tidak ikut dikirim ke browser.
        zona: zonaWaktu(cariProvinsi(s.lon, s.lat), s.lon),
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
