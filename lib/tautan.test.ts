import { describe, expect, it } from "vitest";
import { LAPISAN_BAWAAN, bacaTautan, slug, tulisTautan } from "./tautan";
import { formatJam, zonaWaktu } from "./zona";

describe("tautan", () => {
  it("bawaan menghasilkan URL tanpa query", () => {
    expect(tulisTautan({ hari: 1, prov: null, lapisan: LAPISAN_BAWAAN, hanyaYakin: false, tanggal: null })).toBe("");
  });

  it("bolak-balik baca/tulis menjaga state", () => {
    const s = { hari: 3, prov: "riau-kep-riau", lapisan: { ...LAPISAN_BAWAAN, aqi: false, aod: true }, hanyaYakin: true, tanggal: "2026-10-15" };
    const q = tulisTautan(s);
    expect(q).toBe("?hari=3&prov=riau-kep-riau&lapisan=titik,angin,aod&yakin=1&tgl=2026-10-15");
    expect(bacaTautan(q)).toEqual(s);
  });

  it("nilai asing diabaikan", () => {
    const s = bacaTautan("?hari=9&tgl=kemarin&lapisan=hantu");
    expect(s.hari).toBe(1);
    expect(s.tanggal).toBeNull();
    expect(Object.values(s.lapisan).every((v) => !v)).toBe(true);
  });

  it("slug nama provinsi", () => {
    expect(slug("Riau & Kep. Riau")).toBe("riau-kep-riau");
    expect(slug("DI Yogyakarta")).toBe("di-yogyakarta");
  });
});

describe("zona waktu", () => {
  it("per provinsi, dengan cadangan bujur untuk laut lepas", () => {
    expect(zonaWaktu("Kalimantan Tengah", 113)).toBe("WIB");
    expect(zonaWaktu("Kalimantan Timur & Utara", 116)).toBe("WITA");
    expect(zonaWaktu("Papua Barat", 133)).toBe("WIT");
    expect(zonaWaktu(null, 105)).toBe("WIB");
    expect(zonaWaktu("", 120)).toBe("WITA");
    expect(zonaWaktu(null, 135)).toBe("WIT");
  });

  it("jam mengikuti zona", () => {
    const d = new Date("2026-10-18T05:42:00Z");
    expect(formatJam(d, "WIB")).toMatch(/12[.:]42 WIB$/);
    expect(formatJam(d, "WITA")).toMatch(/13[.:]42 WITA$/);
    expect(formatJam(d, "WIT")).toMatch(/14[.:]42 WIT$/);
  });
});
