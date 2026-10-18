import data from "@/data/provinsi.json";
import dataTetangga from "@/data/tetangga.json";
import type { RingkasanProvinsi } from "./tipe";

// Batas 38 provinsi, turunan OpenStreetMap (ODbL, © OpenStreetMap contributors),
// disederhanakan; dibuat dengan scripts/buat-provinsi.mjs. Hanya dipakai di server.
type Poligon = number[][][]; // [cincin][titik][x,y]
type Provinsi = { nama: string; bbox: [number, number, number, number]; poligon: Poligon[] };

const PROVINSI = data as unknown as Provinsi[];
// Daratan negara tetangga (Natural Earth, domain publik); scripts/buat-tetangga.mjs.
const TETANGGA = dataTetangga as unknown as Provinsi[];

function dalamCincin(x: number, y: number, cincin: number[][]) {
  let dalam = false;
  for (let i = 0, j = cincin.length - 1; i < cincin.length; j = i++) {
    const [xi, yi] = cincin[i];
    const [xj, yj] = cincin[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dalam = !dalam;
  }
  return dalam;
}

function dalamPoligon(x: number, y: number, poligon: Poligon) {
  if (!dalamCincin(x, y, poligon[0])) return false;
  for (let k = 1; k < poligon.length; k++) if (dalamCincin(x, y, poligon[k])) return false;
  return true;
}

// Nama unik, urutannya tetap; TitikApi menyimpan indeks ke daftar ini.
export const NAMA_PROVINSI = [...new Set(PROVINSI.map((p) => p.nama))];
const INDEKS = new Map(NAMA_PROVINSI.map((n, i) => [n, i]));

// Kotak batas gabungan per nama provinsi (satu provinsi bisa punya beberapa entri).
const BBOX = new Map<string, [number, number, number, number]>();
for (const p of PROVINSI) {
  const b = BBOX.get(p.nama);
  BBOX.set(p.nama, b ? [Math.min(b[0], p.bbox[0]), Math.min(b[1], p.bbox[1]), Math.max(b[2], p.bbox[2]), Math.max(b[3], p.bbox[3])] : p.bbox);
}

// Indeks grid agar tiap titik hanya diuji terhadap poligon/titik sudut di
// sekitarnya. Tren 7 hari bisa >200 ribu titik; tanpa grid rute itu >60 detik.
const SEL = 1; // derajat, untuk poligon
// Titik di pesisir yang lolos dari poligon sederhana (~1 km) diberikan ke provinsi
// dengan titik sudut terdekat dalam jarak ini, kecuali titik itu berada di
// daratan negara tetangga (perbatasan darat Papua Nugini, Timor Leste, Malaysia).
const TOLERANSI = 0.1; // derajat, ~11 km

const kunci = (i: number, j: number) => i * 1000 + j;
const gridPoligon = new Map<number, { prov: number; pg: Poligon; bbox: number[] }[]>();
const gridSudut = new Map<number, [number, number, number][]>(); // [x, y, prov]
for (const p of PROVINSI) {
  const prov = INDEKS.get(p.nama)!;
  for (const pg of p.poligon) {
    let [x1, y1, x2, y2] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of pg[0]) {
      [x1, y1, x2, y2] = [Math.min(x1, x), Math.min(y1, y), Math.max(x2, x), Math.max(y2, y)];
      const k = kunci(Math.floor(x / TOLERANSI), Math.floor(y / TOLERANSI));
      const isi = gridSudut.get(k);
      if (isi) isi.push([x, y, prov]);
      else gridSudut.set(k, [[x, y, prov]]);
    }
    const entri = { prov, pg, bbox: [x1, y1, x2, y2] };
    for (let i = Math.floor(x1 / SEL); i <= Math.floor(x2 / SEL); i++)
      for (let j = Math.floor(y1 / SEL); j <= Math.floor(y2 / SEL); j++) {
        const isi = gridPoligon.get(kunci(i, j));
        if (isi) isi.push(entri);
        else gridPoligon.set(kunci(i, j), [entri]);
      }
  }
}

const diTetangga = (lon: number, lat: number) =>
  TETANGGA.some(({ bbox, poligon }) => lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3] && dalamPoligon(lon, lat, poligon[0]));

// -1 berarti di luar Indonesia (negara tetangga atau laut lepas).
export function indeksProvinsi(lon: number, lat: number): number {
  for (const { prov, pg, bbox } of gridPoligon.get(kunci(Math.floor(lon / SEL), Math.floor(lat / SEL))) ?? []) {
    if (lon < bbox[0] || lon > bbox[2] || lat < bbox[1] || lat > bbox[3]) continue;
    if (dalamPoligon(lon, lat, pg)) return prov;
  }
  if (diTetangga(lon, lat)) return -1;
  let terdekat = -1;
  let jarak = TOLERANSI;
  const [ci, cj] = [Math.floor(lon / TOLERANSI), Math.floor(lat / TOLERANSI)];
  for (let i = ci - 1; i <= ci + 1; i++)
    for (let j = cj - 1; j <= cj + 1; j++)
      for (const [x, y, prov] of gridSudut.get(kunci(i, j)) ?? []) {
        const d = Math.hypot(x - lon, y - lat);
        if (d < jarak) {
          jarak = d;
          terdekat = prov;
        }
      }
  return terdekat;
}

export function cariProvinsi(lon: number, lat: number): string | null {
  const i = indeksProvinsi(lon, lat);
  return i < 0 ? null : NAMA_PROVINSI[i];
}

export function ringkasProvinsi(titik: { prov: number; yakin: boolean }[]): RingkasanProvinsi[] {
  const hitung = new Map<number, { jumlah: number; tinggi: number }>();
  for (const t of titik) {
    if (t.prov < 0) continue;
    const h = hitung.get(t.prov) ?? { jumlah: 0, tinggi: 0 };
    h.jumlah++;
    if (t.yakin) h.tinggi++;
    hitung.set(t.prov, h);
  }
  return [...hitung.entries()]
    .map(([i, h]) => ({ nama: NAMA_PROVINSI[i], ...h, bbox: BBOX.get(NAMA_PROVINSI[i])! }))
    .sort((a, b) => b.jumlah - a.jumlah);
}

export const DAFTAR_PROVINSI = NAMA_PROVINSI.map((nama) => ({ nama, bbox: BBOX.get(nama)! }));
