import { sedangBuild } from "@/lib/build";
import { KOTA } from "@/lib/kota";
import type { ResponsUdara, UdaraKota } from "@/lib/tipe";

// Model CAMS (Open-Meteo) diperbarui per jam, jadi cukup refresh tiap jam.
export const revalidate = 3600;
// Tetap ISR walau fetch ke sumber memakai no-store.
export const dynamic = "force-static";

type OpenMeteo = { current?: Record<string, number | null> };

async function ambil(url: string): Promise<OpenMeteo[]> {
  // no-store: hasil rute sudah di-cache ISR, cache kedua hanya menambah umur data.
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  return Array.isArray(json) ? json : [json];
}

export async function GET() {
  const lat = KOTA.map((k) => k.lat).join(",");
  const lon = KOTA.map((k) => k.lon).join(",");
  const [udara, angin] = await Promise.allSettled([
    ambil(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10&timezone=Asia%2FJakarta`),
    ambil(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&timezone=Asia%2FJakarta`),
  ]);
  if (udara.status === "rejected") console.error("Open-Meteo kualitas udara gagal", udara.reason);
  if (angin.status === "rejected") console.error("Open-Meteo angin gagal", angin.reason);
  // Keduanya gagal: biarkan ISR menyajikan data terakhir yang berhasil.
  if (udara.status === "rejected" && angin.status === "rejected" && !sedangBuild()) throw new Error("Open-Meteo gagal");

  const kota: UdaraKota[] = KOTA.map((k, n) => {
    const u = udara.status === "fulfilled" ? udara.value[n]?.current : undefined;
    const a = angin.status === "fulfilled" ? angin.value[n]?.current : undefined;
    return {
      ...k,
      aqi: u?.us_aqi ?? null,
      pm25: u?.pm2_5 ?? null,
      pm10: u?.pm10 ?? null,
      anginKecepatan: a?.wind_speed_10m ?? null,
      anginArah: a?.wind_direction_10m ?? null,
    };
  });

  const data: ResponsUdara = {
    diperbarui: new Date().toISOString(),
    kota,
    gagal: udara.status === "rejected" && angin.status === "rejected",
  };
  return Response.json(data);
}
