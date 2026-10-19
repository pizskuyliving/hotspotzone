import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getUdara } from "@/app/api/udara/route";
import { kategoriAqi } from "./aqi";
import { tanggalCitraDefault, tanggalLayer, urlWms, LAYER_CITRA } from "./gibs";
import { cariProvinsi, indeksProvinsi, NAMA_PROVINSI, ringkasProvinsi } from "./provinsi";

describe("kategoriAqi", () => {
  it("mengikuti batas US AQI", () => {
    expect(kategoriAqi(0).label).toBe("Baik");
    expect(kategoriAqi(50).label).toBe("Baik");
    expect(kategoriAqi(51).label).toBe("Sedang");
    expect(kategoriAqi(151).label).toBe("Tidak sehat");
    expect(kategoriAqi(500).label).toBe("Berbahaya");
    expect(kategoriAqi(902).label).toBe("Berbahaya, melewati skala AQI (>500)");
    expect(kategoriAqi(null).label).toBe("Tidak ada data");
    expect(kategoriAqi(NaN).label).toBe("Tidak ada data");
  });
});

describe("cariProvinsi", () => {
  it("menemukan provinsi untuk kota-kota rawan karhutla", () => {
    expect(cariProvinsi(113.92, -2.21)).toBe("Kalimantan Tengah"); // Palangka Raya
    expect(cariProvinsi(101.45, 0.51)).toBe("Riau"); // Pekanbaru
    expect(cariProvinsi(104.76, -2.99)).toBe("Sumatera Selatan"); // Palembang
    expect(cariProvinsi(109.33, -0.03)).toBe("Kalimantan Barat"); // Pontianak
  });

  it("titik di laut lepas tidak masuk provinsi mana pun", () => {
    expect(cariProvinsi(90, -20)).toBeNull();
    expect(indeksProvinsi(90, -20)).toBe(-1);
  });

  it("titik di seberang perbatasan darat tidak ditarik ke Indonesia", () => {
    expect(cariProvinsi(124.251, -9.31)).toBeNull(); // Oecusse, Timor Leste
    expect(cariProvinsi(141.236, -7.905)).toBeNull(); // Western Province, Papua Nugini
    expect(cariProvinsi(140.714, -7.175)).toBe("Papua Selatan"); // dekat perbatasan, sisi Indonesia
  });

  it("indeks merujuk ke nama yang sama", () => {
    expect(NAMA_PROVINSI[indeksProvinsi(113.92, -2.21)]).toBe("Kalimantan Tengah");
  });

  it("ringkasan diurutkan dari jumlah terbanyak", () => {
    const r = ringkasProvinsi([
      { prov: indeksProvinsi(101.45, 0.51), yakin: false },
      { prov: indeksProvinsi(113.92, -2.21), yakin: true },
      { prov: indeksProvinsi(113.9, -2.2), yakin: false },
      { prov: -1, yakin: true }, // di luar provinsi: tidak dihitung
    ]);
    expect(r.map((p) => [p.nama, p.jumlah, p.tinggi])).toEqual([
      ["Kalimantan Tengah", 2, 1],
      ["Riau", 1, 0],
    ]);
  });
});

describe("gibs", () => {
  it("sebelum 09.00 UTC memakai citra kemarin", () => {
    expect(tanggalCitraDefault(new Date("2026-10-18T08:59:00Z"))).toBe("2026-10-17");
    expect(tanggalCitraDefault(new Date("2026-10-18T09:00:00Z"))).toBe("2026-10-18");
  });

  it("peta asap memakai tanggal terbaru yang sudah tersedia", () => {
    const aod = LAYER_CITRA.find((l) => l.id === "aod")!;
    // Teramati: 18 Okt belum ada pada 19 Okt 05.19 UTC; 17 Okt sudah ada pada 18 Okt 13.40 UTC.
    expect(tanggalLayer(aod, "2026-10-19", new Date("2026-10-19T05:19:00Z"))).toBe("2026-10-17");
    expect(tanggalLayer(aod, "2026-10-19", new Date("2026-10-19T15:00:00Z"))).toBe("2026-10-18");
    expect(tanggalLayer(aod, "2026-10-15", new Date("2026-10-19T05:19:00Z"))).toBe("2026-10-15");
    expect(tanggalLayer(LAYER_CITRA[0], "2026-10-18", new Date("2026-10-18T13:00:00Z"))).toBe("2026-10-18");
  });

  it("placeholder bbox MapLibre tidak di-encode", () => {
    const url = urlWms(LAYER_CITRA[0], "2026-10-18");
    expect(url).toContain("&BBOX={bbox-epsg-3857}");
    expect(url).toContain("TIME=2026-10-18");
  });
});

describe("rute udara", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("salah satu sumber Open-Meteo gagal: lempar galat agar ISR menyimpan data lama", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("air-quality") ? new Response("galat", { status: 500 }) : Response.json([]))));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getUdara()).rejects.toThrow();
  });
});
