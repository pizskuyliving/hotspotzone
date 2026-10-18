import data from "@/data/provinsi.json";
import type { RingkasanProvinsi } from "./tipe";

// Batas provinsi BAKOSURTANAL (versi sederhana, 32 wilayah lama).
// Provinsi pemekaran digabung ke induknya, lihat README.
type Poligon = number[][][]; // [cincin][titik][x,y]
type Provinsi = { nama: string; bbox: [number, number, number, number]; poligon: Poligon[] };

const PROVINSI = data as unknown as Provinsi[];

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

// Titik di pesisir yang lolos dari poligon sederhana diberikan ke provinsi
// dengan kotak batas terdekat (dalam jarak ~0,3 derajat).
export function cariProvinsi(lon: number, lat: number): string | null {
  for (const p of PROVINSI) {
    const [x1, y1, x2, y2] = p.bbox;
    if (lon < x1 || lon > x2 || lat < y1 || lat > y2) continue;
    if (p.poligon.some((pg) => dalamPoligon(lon, lat, pg))) return p.nama;
  }
  let terdekat: string | null = null;
  let jarak = 0.3;
  for (const p of PROVINSI) {
    for (const pg of p.poligon) {
      for (const [x, y] of pg[0]) {
        const d = Math.hypot(x - lon, y - lat);
        if (d < jarak) {
          jarak = d;
          terdekat = p.nama;
        }
      }
    }
  }
  return terdekat;
}

export function ringkasProvinsi(titik: { lon: number; lat: number; yakin: boolean }[]): RingkasanProvinsi[] {
  const hitung = new Map<string, { jumlah: number; tinggi: number }>();
  for (const t of titik) {
    const nama = cariProvinsi(t.lon, t.lat);
    if (!nama) continue;
    const h = hitung.get(nama) ?? { jumlah: 0, tinggi: 0 };
    h.jumlah++;
    if (t.yakin) h.tinggi++;
    hitung.set(nama, h);
  }
  const bbox = new Map<string, [number, number, number, number]>();
  for (const p of PROVINSI) {
    const b = bbox.get(p.nama);
    bbox.set(
      p.nama,
      b ? [Math.min(b[0], p.bbox[0]), Math.min(b[1], p.bbox[1]), Math.max(b[2], p.bbox[2]), Math.max(b[3], p.bbox[3])] : p.bbox,
    );
  }
  return [...hitung.entries()]
    .map(([nama, h]) => ({ nama, ...h, bbox: bbox.get(nama)! }))
    .sort((a, b) => b.jumlah - a.jumlah);
}
