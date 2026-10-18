// Membuat data/provinsi.json dari GeoJSON 38 provinsi yang sudah disederhanakan.
//
// Sumber: kpu-osm-boundaries-2026 (turunan OpenStreetMap, ODbL 1.0,
// © OpenStreetMap contributors), berkas MapNational.geojson. Langkah:
//   npx mapshaper@0.6.113 MapNational.geojson -simplify dp interval=400 keep-shapes \
//     -o format=geojson precision=0.001 sederhana.geojson
//   node scripts/buat-provinsi.mjs sederhana.geojson
import { readFileSync, writeFileSync } from "node:fs";

// Nama ringkas agar muat di panel; sisanya sama dengan nama OSM.
const NAMA = {
  "Daerah Istimewa Yogyakarta": "DI Yogyakarta",
  "Daerah Khusus Jakarta": "DK Jakarta",
  "Kepulauan Bangka Belitung": "Kep. Bangka Belitung",
  "Kepulauan Riau": "Kep. Riau",
};

const masukan = process.argv[2];
if (!masukan) throw new Error("Pakai: node scripts/buat-provinsi.mjs <geojson-sederhana>");
const geo = JSON.parse(readFileSync(masukan, "utf8"));

const bulat = (n) => Math.round(n * 1000) / 1000;
const hasil = geo.features.map((f) => {
  const g = f.geometry;
  const poligon = (g.type === "Polygon" ? [g.coordinates] : g.coordinates).map((pg) => pg.map((cincin) => cincin.map(([x, y]) => [bulat(x), bulat(y)])));
  let [x1, y1, x2, y2] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const pg of poligon) for (const [x, y] of pg[0]) [x1, y1, x2, y2] = [Math.min(x1, x), Math.min(y1, y), Math.max(x2, x), Math.max(y2, y)];
  const nama = NAMA[f.properties.province] ?? f.properties.province;
  return { nama, bbox: [x1, y1, x2, y2], poligon };
});

if (hasil.length !== 38) throw new Error(`Diharapkan 38 provinsi, dapat ${hasil.length}`);
writeFileSync("data/provinsi.json", JSON.stringify(hasil));
console.log(`${hasil.length} provinsi ditulis, ${(JSON.stringify(hasil).length / 1024).toFixed(0)} KB`);
