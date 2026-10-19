import type { ResponsHotspot, ResponsTren, TingkatKeyakinan, TitikApi } from "./tipe";
import { YAKIN_TINGGI } from "./tipe";
import { DAFTAR_PROVINSI, NAMA_PROVINSI, indeksProvinsi, ringkasProvinsi } from "./provinsi";
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
      // 3 desimal (~110 m) cukup untuk piksel VIIRS 375 m; menjaga data 72 jam di bawah batas 4,5 MB.
      Math.round(lon * 1e3) / 1e3,
      Math.round(lat * 1e3) / 1e3,
      Math.round(Number(k[iFrp]) || 0), // MW bulat: desimal tidak berguna di popup, menghemat ukuran data
      keyakinan(k[iConf] ?? ""),
      waktu,
      satelit,
      k[iDn] === "N" ? 1 : 0,
      -1, // diisi lengkapiProvinsi setelah disaring, agar titik yang dibuang tidak ikut dihitung
    ]);
  }
  return hasil;
}

function lengkapiProvinsi(titik: TitikApi[]) {
  for (const t of titik) t[7] = indeksProvinsi(t[0], t[1]);
  return titik;
}

const ringkas = (titik: TitikApi[]) => ringkasProvinsi(titik.map((t) => ({ prov: t[7], yakin: t[3] === YAKIN_TINGGI })));

// FIRMS menerima DAY_RANGE 1-5, maju dari tanggal mulai (UTC) bila diberikan.
const MAKS_RENTANG = 5;

// Potongan permintaan [rentang, tanggal mulai] untuk `hari` tanggal UTC terakhir
// (termasuk hari ini). Tanpa tanggal = hari-hari terbaru.
export function potonganRentang(hari: number, sekarang = Date.now()): [number, string | null][] {
  if (hari <= MAKS_RENTANG) return [[hari, null]];
  const potongan: [number, string | null][] = [];
  const hariIni = Math.floor(sekarang / 86400000);
  for (let mulai = hariIni - hari + 1; mulai <= hariIni; mulai += MAKS_RENTANG) {
    potongan.push([Math.min(MAKS_RENTANG, hariIni - mulai + 1), new Date(mulai * 86400000).toISOString().slice(0, 10)]);
  }
  return potongan;
}

// Mengambil ketiga satelit sekaligus, hanya titik sejak menit `sejak` (UTC).
// Semua satelit gagal: lempar galat agar ISR tetap menyajikan data terakhir
// yang berhasil, bukan menyimpan "0 titik api". Saat build belum ada data
// lama, jadi build tetap jalan dengan hasil kosong.
async function ambilSemuaSatelit(kunci: string, rentangHari: number, sejak: number) {
  const potongan = potonganRentang(rentangHari);
  const hasil = await Promise.allSettled(
    SUMBER_FIRMS.map(async (sumber, n) => {
      const titik: TitikApi[] = [];
      for (const [rentang, tanggal] of potongan) {
        // no-store: hasilnya sudah di-cache oleh ISR rute. Data Cache Next.js
        // juga menolak CSV >2 MB dan mencetak URL (berisi key) ke log.
        const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${kunci}/${sumber}/${BBOX_INDONESIA}/${rentang}${tanggal ? `/${tanggal}` : ""}`;
        const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
        const teks = await res.text();
        if (!res.ok || !teks.startsWith("latitude")) throw new Error(`${sumber}: ${res.status} ${teks.slice(0, 120)}`);
        titik.push(...uraiCsv(teks, n).filter((t) => t[4] >= sejak));
      }
      return lengkapiProvinsi(titik);
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
  if (gagal.length === SUMBER_FIRMS.length && !sedangBuild()) throw new Error("Semua sumber FIRMS gagal");
  return { titik, gagal };
}

export async function ambilHotspot(hari: number): Promise<ResponsHotspot> {
  const kunci = process.env.FIRMS_MAP_KEY;
  if (!kunci) return contohHotspot(hari);

  // DAY_RANGE FIRMS dihitung per tanggal UTC (range 1 = sejak 00.00 UTC hari
  // ini), bukan 24 jam bergulir. Ambil sehari lebih banyak lalu saring, agar
  // lintasan malam kemarin ikut dan mode 24 jam tidak kosong tiap pagi.
  const { titik, gagal } = await ambilSemuaSatelit(kunci, hari + 1, Date.now() / 60000 - hari * 1440);

  return {
    demo: false,
    diperbarui: new Date().toISOString(),
    gagal,
    satelit: LABEL_SATELIT,
    provinsi: DAFTAR_PROVINSI,
    titik,
    ringkasan: ringkas(titik),
  };
}

export const HARI_TREN = 7;
const WIB = 7 * 60; // menit

// Tanggal WIB (YYYY-MM-DD) dari menit sejak epoch UTC.
const tanggalWib = (menit: number) => new Date((menit + WIB) * 60000).toISOString().slice(0, 10);

// Jumlah deteksi per hari (tanggal WIB) selama HARI_TREN hari terakhir, termasuk
// hari ini yang belum lengkap. Satu kebakaran bisa terdeteksi beberapa satelit,
// jadi angkanya adalah jumlah deteksi, bukan jumlah kebakaran.
export function hitungTren(titik: TitikApi[], sekarang = Date.now()): Omit<ResponsTren, "demo" | "diperbarui" | "gagal"> {
  const menitKini = sekarang / 60000;
  const hari = Array.from({ length: HARI_TREN }, (_, i) => tanggalWib(menitKini - (HARI_TREN - 1 - i) * 1440));
  const posisi = new Map(hari.map((h, i) => [h, i]));
  const nasional = hari.map(() => 0);
  const perProvinsi = new Map<number, number[]>();
  for (const t of titik) {
    const i = posisi.get(tanggalWib(t[4]));
    // Di luar Indonesia (negara tetangga) tidak dihitung.
    if (i == null || t[7] < 0) continue;
    nasional[i]++;
    let baris = perProvinsi.get(t[7]);
    if (!baris) perProvinsi.set(t[7], (baris = hari.map(() => 0)));
    baris[i]++;
  }
  const provinsi: Record<string, number[]> = {};
  for (const [i, baris] of perProvinsi) provinsi[NAMA_PROVINSI[i]] = baris;
  return { hari, nasional, provinsi };
}

export async function ambilTren(): Promise<ResponsTren> {
  const kunci = process.env.FIRMS_MAP_KEY;
  const diperbarui = new Date().toISOString();
  if (!kunci) return { demo: true, diperbarui, gagal: [], ...hitungTren(contohHotspot(HARI_TREN).titik) };

  // Awal hari WIB, HARI_TREN-1 hari lalu; +1 hari karena DAY_RANGE dihitung per tanggal UTC.
  const kini = Date.now() / 60000;
  const awal = Math.floor((kini + WIB) / 1440) * 1440 - WIB - (HARI_TREN - 1) * 1440;
  const { titik, gagal } = await ambilSemuaSatelit(kunci, HARI_TREN + 1, awal);
  return { demo: false, diperbarui, gagal, ...hitungTren(titik) };
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
      const frp = Math.round(acak() ** 3 * 120) + 1;
      const conf: TingkatKeyakinan = acak() > 0.75 ? 2 : acak() > 0.2 ? 1 : 0;
      const waktu = sekarang - Math.floor(acak() * hari * 1440);
      titik.push([lon + Math.cos(a) * r, lat + Math.sin(a) * r * 0.7, frp, conf, waktu, acak() > 0.5 ? 1 : 0, acak() > 0.3 ? 0 : 1, -1]);
    }
  }
  lengkapiProvinsi(titik);
  return {
    demo: true,
    diperbarui: new Date().toISOString(),
    gagal: [],
    satelit: LABEL_SATELIT,
    provinsi: DAFTAR_PROVINSI,
    titik,
    ringkasan: ringkas(titik),
  };
}
