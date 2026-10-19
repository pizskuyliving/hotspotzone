import { BBOX_INDONESIA } from "./firms";
import type { SumberAqi } from "./tipe";

export type WaqiStasiun = { lat: number; lon: number; uid: number; aqi: string; station?: { name?: string; time?: string } };

const API = "https://api.waqi.info";

// no-store: hasil rute sudah di-cache ISR.
async function ambil(url: string, ms = 30_000) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ms) });
  const json = (await res.json()) as { status: string; data: unknown };
  if (json.status !== "ok") throw new Error(String(json.data));
  return json.data;
}

export async function ambilPetaWaqi(token: string): Promise<WaqiStasiun[]> {
  const [barat, selatan, timur, utara] = BBOX_INDONESIA.split(",");
  const data = await ambil(`${API}/v2/map/bounds?latlng=${selatan},${barat},${utara},${timur}&networks=all&token=${encodeURIComponent(token)}`);
  if (!Array.isArray(data)) throw new Error("Format WAQI tidak dikenali");
  return data as WaqiStasiun[];
}

// Atribusi datang dari pihak ketiga dan ditaruh di href popup: hanya http(s),
// agar tautan javascript: atau data: tidak bisa disisipkan.
export function atribusiAman(atribusi: unknown): SumberAqi[] {
  if (!Array.isArray(atribusi)) return [];
  return atribusi.flatMap((a) => {
    const nama = typeof a?.name === "string" ? a.name.trim() : "";
    try {
      const url = new URL(a?.url);
      return nama && (url.protocol === "https:" || url.protocol === "http:") ? [{ nama, url: url.href }] : [];
    } catch {
      return [];
    }
  });
}

export async function ambilSumberStasiun(token: string, uid: number): Promise<SumberAqi[]> {
  // 5 detik: ~190 stasiun dalam 10 gelombang harus selesai <60 detik saat build
  // (batas Next.js per halaman); stasiun yang lambat jatuh ke tautan WAQI umum.
  const data = (await ambil(`${API}/feed/@${uid}/?token=${encodeURIComponent(token)}`, 5_000)) as { attributions?: unknown };
  return atribusiAman(data?.attributions);
}
