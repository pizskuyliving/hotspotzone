import { describe, expect, it } from "vitest";
import { kategoriAqi } from "./aqi";
import { tanggalCitraDefault, urlWms, LAYER_CITRA } from "./gibs";
import { cariProvinsi, ringkasProvinsi } from "./provinsi";

describe("kategoriAqi", () => {
  it("mengikuti batas US AQI", () => {
    expect(kategoriAqi(0).label).toBe("Baik");
    expect(kategoriAqi(50).label).toBe("Baik");
    expect(kategoriAqi(51).label).toBe("Sedang");
    expect(kategoriAqi(151).label).toBe("Tidak sehat");
    expect(kategoriAqi(500).label).toBe("Berbahaya");
    expect(kategoriAqi(null).label).toBe("Tidak ada data");
    expect(kategoriAqi(NaN).label).toBe("Tidak ada data");
  });
});

describe("cariProvinsi", () => {
  it("menemukan provinsi untuk kota-kota rawan karhutla", () => {
    expect(cariProvinsi(113.92, -2.21)).toBe("Kalimantan Tengah"); // Palangka Raya
    expect(cariProvinsi(101.45, 0.51)).toBe("Riau & Kep. Riau"); // Pekanbaru
    expect(cariProvinsi(104.76, -2.99)).toBe("Sumatera Selatan"); // Palembang
    expect(cariProvinsi(109.33, -0.03)).toBe("Kalimantan Barat"); // Pontianak
  });

  it("titik di laut lepas tidak masuk provinsi mana pun", () => {
    expect(cariProvinsi(90, -20)).toBeNull();
  });

  it("ringkasan diurutkan dari jumlah terbanyak", () => {
    const r = ringkasProvinsi([
      { lon: 101.45, lat: 0.51, yakin: false },
      { lon: 113.92, lat: -2.21, yakin: true },
      { lon: 113.9, lat: -2.2, yakin: false },
    ]);
    expect(r.map((p) => [p.nama, p.jumlah, p.tinggi])).toEqual([
      ["Kalimantan Tengah", 2, 1],
      ["Riau & Kep. Riau", 1, 0],
    ]);
  });
});

describe("gibs", () => {
  it("sebelum 09.00 UTC memakai citra kemarin", () => {
    expect(tanggalCitraDefault(new Date("2026-10-18T08:59:00Z"))).toBe("2026-10-17");
    expect(tanggalCitraDefault(new Date("2026-10-18T09:00:00Z"))).toBe("2026-10-18");
  });

  it("placeholder bbox MapLibre tidak di-encode", () => {
    const url = urlWms(LAYER_CITRA[0], "2026-10-18");
    expect(url).toContain("&BBOX={bbox-epsg-3857}");
    expect(url).toContain("TIME=2026-10-18");
  });
});
