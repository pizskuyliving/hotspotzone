import { afterEach, describe, expect, it, vi } from "vitest";
import { ambilHotspot, uraiCsv } from "./firms";

const KEPALA = "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight";
const baris = (lat: number, lon: number, tgl: string, jam: string, conf: string, frp: string, dn: string) =>
  `${lat},${lon},330,0.4,0.4,${tgl},${jam},N20,VIIRS,${conf},2.0NRT,290,${frp},${dn}`;

describe("uraiCsv", () => {
  it("mengubah baris CSV FIRMS menjadi tuple ringkas", () => {
    const csv = [KEPALA, baris(-2.123456, 113.987654, "2026-10-18", "542", "h", "12.34", "N")].join("\n");
    expect(uraiCsv(csv, 1)).toEqual([[113.9877, -2.1235, 12.3, 2, Date.parse("2026-10-18T05:42:00Z") / 60000, 1, 1]]);
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
    expect(data.sumber).toHaveLength(2);
  });
});
