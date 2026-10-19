// Kategori US AQI (dipakai WAQI dan Open-Meteo us_aqi).
export const KATEGORI_AQI = [
  { batas: 50, label: "Baik", warna: "#2fb36d" },
  { batas: 100, label: "Sedang", warna: "#e8c51d" },
  { batas: 150, label: "Tidak sehat bagi kelompok sensitif", warna: "#f08a24" },
  { batas: 200, label: "Tidak sehat", warna: "#e2412f" },
  { batas: 300, label: "Sangat tidak sehat", warna: "#8f3f97" },
  { batas: Infinity, label: "Berbahaya", warna: "#7e0023" },
] as const;

export function kategoriAqi(aqi: number | null | undefined) {
  if (aqi == null || Number.isNaN(aqi)) return { label: "Tidak ada data", warna: "#8a8f98" };
  // Skala US AQI resmi berhenti di 500; model CAMS bisa memberi nilai lebih tinggi saat kabut asap parah.
  if (aqi > 500) return { label: "Berbahaya, melewati skala AQI (>500)", warna: KATEGORI_AQI[5].warna };
  return KATEGORI_AQI.find((k) => aqi <= k.batas)!;
}

// Ekspresi warna MapLibre berdasarkan properti "aqi".
export const EKSPRESI_WARNA_AQI = [
  "step",
  ["get", "aqi"],
  KATEGORI_AQI[0].warna,
  51,
  KATEGORI_AQI[1].warna,
  101,
  KATEGORI_AQI[2].warna,
  151,
  KATEGORI_AQI[3].warna,
  201,
  KATEGORI_AQI[4].warna,
  301,
  KATEGORI_AQI[5].warna,
];
