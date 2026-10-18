export const NAMA_SITUS = "hotspotzone.id";
export const JUDUL_SITUS = `${NAMA_SITUS} · Titik Api, Asap & Kualitas Udara Indonesia`;
export const DESKRIPSI_SITUS =
  "Peta titik api (hotspot) dari satelit NASA, sebaran asap, dan indeks kualitas udara (AQI) di seluruh Indonesia, diperbarui otomatis.";

// Vercel mengisi VERCEL_PROJECT_PRODUCTION_URL dengan domain produksi
// (domain kustom bila sudah dipasang), jadi tidak perlu ditulis manual.
export const URL_SITUS = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

// Bentuk api untuk favicon dan gambar pratinjau (viewBox 0 0 64 64),
// diperbesar dan ditengahkan lewat TRANSFORM_API. Salinannya ada di app/icon.svg.
export const PATH_API =
  "M32 6c2 9 12 15 12 28a12 12 0 0 1-24 0c0-6 3-10 6-13 0 5 2 8 5 9-1-9 1-17 1-24z";
export const TRANSFORM_API = "translate(-8 -0.5) scale(1.25)";
