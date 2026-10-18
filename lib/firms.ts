import type { ResponsHotspot, TingkatKeyakinan, TitikApi } from "./tipe";
import { YAKIN_TINGGI } from "./tipe";
import { ringkasProvinsi } from "./provinsi";
import { sedangBuild } from "./build";

// Kotak batas Indonesia: barat, selatan, timur, utara.
export const BBOX_INDONESIA = "94,-11.5,141.5,6.5";

// Tiga satelit VIIRS (resolusi 375 m), data near real-time.
export const SUMBER_FIRMS = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"] as const;

// Urutannya sama dengan SUMBER_FIRMS; TitikApi menyimpan indeksnya.
const LABEL_SATELIT = ["Suomi NPP", "NOAA-20", "NOAA-21"];

function keyakinan(nilai: string): TingkatKeyakinan {
  const v = nilai.trim().toLowerCase();
  if (v === "h" || v === "high") return 2;
  if (v === "l" || v === "low") return 0;
  const angka = Number(v);
  if (!Number.isNaN(angka) && v !== "") return angka >= 80 ? 2 : angka < 30 ? 0 : 1;
  return 1;
}

export function uraiCsv(csv: string, satelit: number): TitikApi[] {
  const baris = csv.trim().split(/\r?\n/);
  if (baris.length < 2) return [];
  const kepala = baris[0].split(",");
  const i = (k: string) => kepala.indexOf(k);
  const iLat = i("latitude"), iLon = i("longitude"), iFrp = i("frp"), iConf = i("confidence");
  const iTgl = i("acq_date"), iJam = i("acq_time"), iDn = i("daynight");
  if (iLat < 0 || iLon < 0) throw new Error("Format CSV FIRMS tidak dikenali");

  const hasil: TitikApi[] = [];
  for (let n = 1; n < baris.length; n++) {
    const k = baris[n].split(",");
    const lat = Number(k[iLat]);
    const lon = Number(k[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const jam = (k[iJam] ?? "0000").padStart(4, "0");
    const waktu = Date.parse(`${k[iTgl]}T${jam.slice(0, 2)}:${jam.slice(2)}:00Z`) / 60000;
    if (!Number.isFinite(waktu)) continue;
    hasil.push([
      Math.round(lon * 1e4) / 1e4,
      Math.round(lat * 1e4) / 1e4,
      Math.round((Number(k[iFrp]) || 0) * 10) / 10,
      keyakinan(k[iConf] ?? ""),
      waktu,
      satelit,
      k[iDn] === "N" ? 1 : 0,
    ]);
  }
  return hasil;
}

export async function ambilHotspot(hari: number): Promise<ResponsHotspot> {
  const kunci = process.env.FIRMS_MAP_KEY;
  if (!kunci) return contohHotspot(hari);

  // DAY_RANGE FIRMS dihitung per tanggal UTC (range 1 = sejak 00.00 UTC hari
  // ini), bukan 24 jam bergulir. Ambil sehari lebih banyak lalu saring, agar
  // lintasan malam kemarin ikut dan mode 24 jam tidak kosong tiap pagi.
  const batas = Date.now() / 60000 - hari * 1440;

  const hasil = await Promise.allSettled(
    SUMBER_FIRMS.map(async (sumber, n) => {
      // no-store: hasilnya sudah di-cache oleh ISR rute. Data Cache Next.js
      // juga menolak CSV >2 MB dan mencetak URL (berisi key) ke log.
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${kunci}/${sumber}/${BBOX_INDONESIA}/${hari + 1}`;
      const res = await fetch(url, { cache: "no-store" });
      const teks = await res.text();
      if (!res.ok || !teks.startsWith("latitude")) throw new Error(`${sumber}: ${res.status} ${teks.slice(0, 120)}`);
      return uraiCsv(teks, n).filter((t) => t[4] >= batas);
    }),
  );

  const titik: TitikApi[] = [];
  const gagal: string[] = [];
  hasil.forEach((h, n) => {
    if (h.status === "fulfilled") titik.push(...h.value);
    else {
      gagal.push(SUMBER_FIRMS[n]);
      console.error("FIRMS gagal", h.reason);
    }
  });

  // Semua satelit gagal: lempar galat agar ISR tetap menyajikan data terakhir
  // yang berhasil, bukan menyimpan "0 titik api" selama 15 menit. Saat build
  // belum ada data lama, jadi build tetap jalan dengan hasil kosong.
  if (gagal.length === SUMBER_FIRMS.length && !sedangBuild()) throw new Error("Semua sumber FIRMS gagal");

  return {
    demo: false,
    hari,
    diperbarui: new Date().toISOString(),
    sumber: SUMBER_FIRMS.filter((s) => !gagal.includes(s)),
    gagal,
    satelit: LABEL_SATELIT,
    titik,
    ringkasan: ringkasProvinsi(titik.map(([lon, lat, , conf]) => ({ lon, lat, yakin: conf === YAKIN_TINGGI }))),
  };
}

// Data contoh untuk pengembangan lokal tanpa FIRMS_MAP_KEY.
// Disebar di sekitar daerah rawan karhutla, ditandai demo: true.
function contohHotspot(hari: number): ResponsHotspot {
  const pusat: [number, number, number][] = [
    [113.9, -2.4, 140], [112.9, -2.7, 90], [110.2, -1.4, 70], [114.6, -3.1, 50],
    [101.6, 0.8, 80], [103.5, -1.5, 70], [104.8, -3.2, 120], [105.4, -3.9, 60],
    [116.6, -0.6, 30], [140.3, -7.9, 40], [123.9, -9.9, 25],
  ];
  let biji = 7 * hari;
  const acak = () => ((biji = (biji * 16807) % 2147483647) - 1) / 2147483646;
  const titik: TitikApi[] = [];
  const sekarang = Math.floor(Date.now() / 60000);
  for (const [lon, lat, n] of pusat) {
    for (let k = 0; k < n * hari; k++) {
      const r = acak() * 0.9, a = acak() * Math.PI * 2;
      const frp = Math.round(acak() ** 3 * 120 * 10) / 10 + 1;
      const conf: TingkatKeyakinan = acak() > 0.75 ? 2 : acak() > 0.2 ? 1 : 0;
      const waktu = sekarang - Math.floor(acak() * hari * 1440);
      titik.push([lon + Math.cos(a) * r, lat + Math.sin(a) * r * 0.7, frp, conf, waktu, acak() > 0.5 ? 1 : 0, acak() > 0.3 ? 0 : 1]);
    }
  }
  return {
    demo: true,
    hari,
    diperbarui: new Date().toISOString(),
    sumber: [],
    gagal: [],
    satelit: LABEL_SATELIT,
    titik,
    ringkasan: ringkasProvinsi(titik.map(([lon, lat, , conf]) => ({ lon, lat, yakin: conf === YAKIN_TINGGI }))),
  };
}
