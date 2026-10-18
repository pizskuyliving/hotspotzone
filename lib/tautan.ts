// State yang bisa dibagikan lewat URL, misalnya ?hari=3&prov=riau-kep-riau&lapisan=titik,aod
// Hanya nilai yang berbeda dari bawaan yang ditulis, agar link tetap pendek.
export type KunciLapisan = "titik" | "aqi" | "angin" | "truecolor" | "aod";
export type StateTautan = {
  hari: number;
  prov: string | null; // slug provinsi
  lapisan: Record<KunciLapisan, boolean>;
  hanyaYakin: boolean;
  tanggal: string | null; // tanggal citra; null = bawaan
};

export const LAPISAN_BAWAAN: Record<KunciLapisan, boolean> = { titik: true, aqi: true, angin: true, truecolor: false, aod: false };
const KUNCI = Object.keys(LAPISAN_BAWAAN) as KunciLapisan[];

export const slug = (nama: string) =>
  nama
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function bacaTautan(cari: string): StateTautan {
  const q = new URLSearchParams(cari);
  const hari = Number(q.get("hari"));
  const lapisanQ = q.get("lapisan");
  const lapisan = { ...LAPISAN_BAWAAN };
  if (lapisanQ != null) {
    const aktif = new Set(lapisanQ.split(","));
    for (const k of KUNCI) lapisan[k] = aktif.has(k);
  }
  const tanggal = q.get("tgl");
  return {
    hari: [1, 2, 3].includes(hari) ? hari : 1,
    prov: q.get("prov") ? slug(q.get("prov")!) : null,
    lapisan,
    hanyaYakin: q.get("yakin") === "1",
    tanggal: tanggal && /^\d{4}-\d{2}-\d{2}$/.test(tanggal) ? tanggal : null,
  };
}

export function tulisTautan(s: StateTautan): string {
  const q = new URLSearchParams();
  if (s.hari !== 1) q.set("hari", String(s.hari));
  if (s.prov) q.set("prov", s.prov);
  if (KUNCI.some((k) => s.lapisan[k] !== LAPISAN_BAWAAN[k])) q.set("lapisan", KUNCI.filter((k) => s.lapisan[k]).join(","));
  if (s.hanyaYakin) q.set("yakin", "1");
  if (s.tanggal) q.set("tgl", s.tanggal);
  const teks = q.toString().replaceAll("%2C", ",");
  return teks ? `?${teks}` : "";
}
