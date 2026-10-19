import { sedangBuild } from "@/lib/build";
import type { ResponsSumberAqi, SumberAqi } from "@/lib/tipe";
import { ambilPetaWaqi, ambilSumberStasiun } from "@/lib/waqi";

// Sumber asli tiap stasiun (misalnya KLHK, kedutaan AS) hanya ada di endpoint
// per stasiun WAQI. Jarang berubah, jadi cukup diambil sehari sekali: ~190
// permintaan per hari, bukan per 10 menit seperti /api/aqi.
export const revalidate = 86400;
export const dynamic = "force-static";

const KELOMPOK = 20; // permintaan paralel ke WAQI per gelombang

export async function GET() {
  const token = process.env.WAQI_TOKEN;
  const stasiun: Record<string, SumberAqi[]> = {};
  if (!token) return Response.json({ diperbarui: new Date().toISOString(), stasiun } satisfies ResponsSumberAqi);

  let uid: number[];
  try {
    uid = (await ambilPetaWaqi(token)).map((s) => s.uid);
  } catch (e) {
    console.error("WAQI gagal", e);
    if (!sedangBuild()) throw e;
    uid = [];
  }
  for (let i = 0; i < uid.length; i += KELOMPOK) {
    const hasil = await Promise.allSettled(uid.slice(i, i + KELOMPOK).map((u) => ambilSumberStasiun(token, u)));
    // Stasiun yang gagal dilewati: popup jatuh ke atribusi WAQI umum.
    hasil.forEach((h, n) => h.status === "fulfilled" && h.value.length && (stasiun[uid[i + n]] = h.value));
  }
  return Response.json({ diperbarui: new Date().toISOString(), stasiun } satisfies ResponsSumberAqi);
}
