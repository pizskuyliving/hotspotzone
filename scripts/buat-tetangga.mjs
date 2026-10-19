// Membuat data/tetangga.json: daratan negara tetangga di sekitar Indonesia.
// Dipakai agar titik api di sisi seberang perbatasan darat (Papua Nugini,
// Timor Leste, Malaysia) tidak ikut ditarik ke provinsi Indonesia oleh
// toleransi pesisir di lib/provinsi.ts. Juga menentukan jam negara untuk
// stasiun WAQI di luar Indonesia (lib/zona.ts).
//
// Sumber: Natural Earth 1:50m admin 0 countries (domain publik),
// https://github.com/nvkelso/natural-earth-vector, berkas ne_50m_admin_0_countries.geojson.
//   node scripts/buat-tetangga.mjs ne_50m_admin_0_countries.geojson
import { readFileSync, writeFileSync } from "node:fs";

const NEGARA = { PNG: "Papua Nugini", TLS: "Timor Leste", MYS: "Malaysia", BRN: "Brunei", SGP: "Singapura", PHL: "Filipina", THA: "Thailand" };
const [B, S, T, U] = [94, -11.5, 141.5, 6.5]; // BBOX_INDONESIA dengan sedikit kelonggaran
const LONGGAR = 0.5;

const masukan = process.argv[2];
if (!masukan) throw new Error("Pakai: node scripts/buat-tetangga.mjs <ne_50m_admin_0_countries.geojson>");
const geo = JSON.parse(readFileSync(masukan, "utf8"));
const bulat = (n) => Math.round(n * 1000) / 1000;

const hasil = [];
for (const f of geo.features) {
  const nama = NEGARA[f.properties.ADM0_A3];
  if (!nama) continue;
  const g = f.geometry;
  for (const pg of g.type === "Polygon" ? [g.coordinates] : g.coordinates) {
    const cincin = pg.map((c) => c.map(([x, y]) => [bulat(x), bulat(y)]));
    const xs = cincin[0].map((p) => p[0]), ys = cincin[0].map((p) => p[1]);
    const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    // Hanya poligon yang bersinggungan dengan kotak Indonesia.
    if (bbox[2] < B - LONGGAR || bbox[0] > T + LONGGAR || bbox[3] < S - LONGGAR || bbox[1] > U + LONGGAR) continue;
    hasil.push({ nama, bbox, poligon: [cincin] });
  }
}
writeFileSync("data/tetangga.json", JSON.stringify(hasil));
console.log(`${hasil.length} poligon dari ${new Set(hasil.map((h) => h.nama)).size} negara, ${(JSON.stringify(hasil).length / 1024).toFixed(0)} KB`);
