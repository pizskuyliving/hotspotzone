import { afterEach, describe, expect, it, vi } from "vitest";
import { ambilHotspot, hitungTren, potonganRentang, uraiCsv } from "./firms";
import type { TitikApi } from "./tipe";

const KEPALA = "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight";
const baris = (lat: number, lon: number, tgl: string, jam: string, conf: string, frp: string, dn: string) =>
  `${lat},${lon},330,0.4,0.4,${tgl},${jam},N20,VIIRS,${conf},2.0NRT,290,${frp},${dn}`;

describe("uraiCsv", () => {
  it("mengubah baris CSV FIRMS menjadi tuple ringkas", () => {
    const csv = [KEPALA, baris(-2.123456, 113.987654, "2026-10-18", "542", "h", "12.34", "N")].join("\n");
    expect(uraiCsv(csv, 1)).toEqual([[113.988, -2.123, 12, 2, Date.parse("2026-10-18T05:42:00Z") / 60000, 1, 1, -1]]);
  });

  it("memetakan keyakinan huruf VIIRS dan angka MODIS", () => {
    const csv = [KEPALA, ...["l", "n", "h", "low", "high", "10", "50", "90", ""].map((c) => baris(0, 100, "2026-10-18", "0100", c, "1", "D"))].join("\n");
    expect(uraiCsv(csv, 0).map((t) => t[3])).toEqual([0, 1, 2, 0, 2, 0, 1, 2, 1]);
  });

  it("melewati baris rusak dan menerima CRLF", () => {
    const csv = [KEPALA, "x,y,,,,,,,,,,,,", baris(1, 101, "2026-10-18", "0100", "n", "1", "D"), baris(1, 101, "bukan-tanggal", "0100", "n", "1", "D")].join("\r\n");
    expect(uraiCsv(csv, 0)).toHaveLength(1);
  });

  it("CSV kosong menghasilkan daftar kosong, kepala asing ditolak", () => {
    expect(uraiCsv(KEPALA, 0)).toEqual([]);
    expect(() => uraiCsv("a,b\n1,2", 0)).toThrow();
  });
});

describe("ambilHotspot", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("tanpa key memakai data contoh", async () => {
    vi.stubEnv("FIRMS_MAP_KEY", "");
    const data = await ambilHotspot(1);
    expect(data.demo).toBe(true);
    expect(data.titik.length).toBeGreaterThan(0);
  });

  it("meminta sehari lebih banyak lalu menyaring ke 24 jam bergulir", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-18T13:40:00Z"), toFake: ["Date"] });
    vi.stubEnv("FIRMS_MAP_KEY", "uji");
    const csv = [
      KEPALA,
      baris(-2, 113, "2026-10-18", "0542", "n", "5", "D"), // 8 jam lalu
      baris(-2, 113, "2026-10-17", "1830", "n", "5", "N"), // lintasan malam kemarin, 19 jam lalu
      baris(-2, 113, "2026-10-17", "0542", "n", "5", "D"), // 32 jam lalu, di luar 24 jam
    ].join("\n");
    const fetchPalsu = vi.fn(async (_url: string) => new Response(csv));
    vi.stubGlobal("fetch", fetchPalsu);

    const data = await ambilHotspot(1);
    expect(fetchPalsu).toHaveBeenCalledTimes(3);
    for (const [url] of fetchPalsu.mock.calls) expect(url).toMatch(/\/2$/);
    // 2 titik dalam 24 jam x 3 satelit
    expect(data.titik).toHaveLength(6);
    expect(data.titik.some((t) => t[6] === 1)).toBe(true);
    expect(data.gagal).toEqual([]);
  });

  it("melempar galat bila semua satelit gagal, agar ISR menyimpan data lama", async () => {
    vi.stubEnv("FIRMS_MAP_KEY", "uji");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Invalid MAP_KEY.", { status: 400 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(ambilHotspot(1)).rejects.toThrow();
  });

  it("satu satelit gagal tetap mengembalikan data dari satelit lain", async () => {
    vi.stubEnv("FIRMS_MAP_KEY", "uji");
    const csv = [KEPALA, baris(-2, 113, new Date().toISOString().slice(0, 10), "0000", "n", "5", "D")].join("\n");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.includes("NOAA21") ? new Response("galat", { status: 500 }) : new Response(csv))),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const data = await ambilHotspot(1);
    expect(data.gagal).toEqual(["VIIRS_NOAA21_NRT"]);
    expect(data.titik.length).toBeGreaterThan(0);
  });
});

describe("hitungTren", () => {
  const menit = (iso: string) => Date.parse(iso) / 60000;
  const titik = (iso: string, prov: number): TitikApi => [113, -2, 5, 1, menit(iso), 0, 0, prov];

  it("mengelompokkan per tanggal WIB, 7 hari terakhir termasuk hari ini", () => {
    const kini = Date.parse("2026-10-18T13:40:00Z"); // 18 Okt 20.40 WIB
    const r = hitungTren(
      [
        titik("2026-10-18T05:00:00Z", 0), // 18 Okt
        titik("2026-10-17T18:30:00Z", 0), // 18 Okt 01.30 WIB, bukan 17 Okt
        titik("2026-10-17T16:00:00Z", 1), // 17 Okt 23.00 WIB
        titik("2026-10-12T05:00:00Z", 1), // 12 Okt: hari pertama
        titik("2026-10-11T05:00:00Z", 1), // 11 Okt: di luar 7 hari
        titik("2026-10-18T05:00:00Z", -1), // di luar Indonesia: tidak dihitung
      ],
      kini,
    );
    expect(r.hari).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(r.nasional).toEqual([1, 0, 0, 0, 0, 1, 2]);
    expect(Object.values(r.provinsi).map((b) => b.reduce((a, x) => a + x, 0)).sort()).toEqual([2, 2]);
  });
});

describe("potonganRentang", () => {
  it("rentang pendek: satu permintaan hari terbaru", () => {
    expect(potonganRentang(4)).toEqual([[4, null]]);
  });

  it("8 hari dipecah 5 + 3, berakhir hari ini (UTC)", () => {
    expect(potonganRentang(8, Date.parse("2026-10-18T13:40:00Z"))).toEqual([
      [5, "2026-10-11"],
      [3, "2026-10-16"],
    ]);
  });
});
