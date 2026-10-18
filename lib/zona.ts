// Zona waktu Indonesia per provinsi. Nama lama (gabungan 32 wilayah) dan
// nama 38 provinsi sama-sama dicantumkan agar penggantian data batas tidak
// memutus pemetaan ini.
export type Zona = "WIB" | "WITA" | "WIT";

export const TZ_ZONA: Record<Zona, string> = { WIB: "Asia/Jakarta", WITA: "Asia/Makassar", WIT: "Asia/Jayapura" };

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

const FORMAT = new Map<Zona, Intl.DateTimeFormat>();
export function formatJam(d: Date, zona: Zona) {
  let f = FORMAT.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ_ZONA[zona] });
    FORMAT.set(zona, f);
  }
  return `${f.format(d)} ${zona}`;
}
