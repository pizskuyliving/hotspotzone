// Zona waktu Indonesia per provinsi. Nama lama (gabungan 32 wilayah) dan
// nama 38 provinsi sama-sama dicantumkan agar penggantian data batas tidak
// memutus pemetaan ini.
export type Zona = "WIB" | "WITA" | "WIT";

// Stasiun WAQI di negara tetangga memakai jam negaranya; nama sama dengan data/tetangga.json.
export type ZonaStasiun = Zona | "Malaysia" | "Singapura" | "Brunei" | "Filipina" | "Timor Leste" | "Papua Nugini" | "Thailand";

export const TZ_ZONA: Record<ZonaStasiun, string> = {
  WIB: "Asia/Jakarta",
  WITA: "Asia/Makassar",
  WIT: "Asia/Jayapura",
  Malaysia: "Asia/Kuala_Lumpur",
  Singapura: "Asia/Singapore",
  Brunei: "Asia/Brunei",
  Filipina: "Asia/Manila",
  "Timor Leste": "Asia/Dili",
  "Papua Nugini": "Pacific/Port_Moresby",
  Thailand: "Asia/Bangkok",
};

const INDONESIA: readonly string[] = ["WIB", "WITA", "WIT"];

// Zona stasiun: provinsi Indonesia, lalu negara tetangga, lalu perkiraan bujur.
export function zonaStasiun(provinsi: string | null, negara: string | null, bujur: number): ZonaStasiun {
  if (provinsi) return zonaWaktu(provinsi, bujur);
  return negara && negara in TZ_ZONA ? (negara as ZonaStasiun) : zonaWaktu(null, bujur);
}

const WITA = [
  "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur",
  "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara", "Kalimantan Timur & Utara",
  "Sulawesi Utara", "Gorontalo", "Sulawesi Tengah", "Sulawesi Barat", "Sulawesi Selatan", "Sulawesi Selatan & Barat", "Sulawesi Tenggara",
];
const WIT = [
  "Maluku", "Maluku Utara",
  "Papua", "Papua Barat", "Papua Barat Daya", "Papua Selatan", "Papua Tengah", "Papua Pegunungan",
];
const ZONA_PROVINSI = new Map<string, Zona>([...WITA.map((n) => [n, "WITA"] as const), ...WIT.map((n) => [n, "WIT"] as const)]);

// Titik di luar provinsi (laut lepas) memakai perkiraan bujur.
export function zonaWaktu(provinsi: string | null | undefined, bujur: number): Zona {
  if (provinsi) return ZONA_PROVINSI.get(provinsi) ?? "WIB";
  return bujur < 114.5 ? "WIB" : bujur < 127 ? "WITA" : "WIT";
}

const FORMAT = new Map<ZonaStasiun, Intl.DateTimeFormat>();
// Teks "Diukur …" untuk popup stasiun. Beberapa stasiun KLHK di WITA/WIT
// mencatat jam 1-2 jam lebih maju (selisih zona terhitung dua kali), tapi tidak
// semua, jadi tidak bisa dikoreksi otomatis; jam di masa depan diberi tanda.
export function teksDiukur(waktu: string | null | undefined, zona: ZonaStasiun, sekarang = Date.now()) {
  const ms = Date.parse(waktu ?? "");
  if (!Number.isFinite(ms)) return null;
  const jam = `Diukur ${formatJam(new Date(ms), zona)}`;
  return ms > sekarang ? `${jam} (jam dari sumber lebih maju dari sekarang)` : jam;
}

export function formatJam(d: Date, zona: ZonaStasiun) {
  let f = FORMAT.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ_ZONA[zona] });
    FORMAT.set(zona, f);
  }
  return `${f.format(d)} ${INDONESIA.includes(zona) ? zona : `waktu ${zona}`}`;
}
