import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Memuat public/sw.js apa adanya dengan self, caches dan fetch tiruan.
const KODE = readFileSync("public/sw.js", "utf8");
const ASAL = "https://hotspotzone.test";

function pasang({ putGagal = false } = {}) {
  const penangan: Record<string, (e: unknown) => void> = {};
  const simpanan = new Map<string, Map<string, Response>>();
  const caches = {
    open: async (nama: string) => {
      const isi = simpanan.get(nama) ?? new Map<string, Response>();
      simpanan.set(nama, isi);
      return {
        put: async (req: Request, res: Response) => {
          if (putGagal) throw new Error("kuota penuh");
          isi.delete(req.url); // Cache API: entri yang ditimpa pindah ke urutan terakhir
          isi.set(req.url, res);
        },
        keys: async () => [...isi.keys()].map((u) => new Request(u)),
        delete: async (req: Request) => isi.delete(req.url),
      };
    },
    match: async () => undefined,
    keys: async () => [...simpanan.keys()],
    delete: async (nama: string) => simpanan.delete(nama),
  };
  // Respons buatan bertipe "default"; sw.js hanya menyimpan respons "basic" (asal sama).
  const fetch = async () => Object.defineProperty(new Response("isi"), "type", { value: "basic" });
  const self = { addEventListener: (t: string, f: (e: unknown) => void) => (penangan[t] = f), location: { origin: ASAL } };
  new Function("self", "caches", "fetch", KODE)(self, caches, fetch);

  const ambil = async (path: string) => {
    let respons: Promise<Response> | undefined;
    const latar: Promise<unknown>[] = [];
    penangan.fetch({ request: new Request(ASAL + path), respondWith: (p: Promise<Response>) => (respons = p), waitUntil: (p: Promise<unknown>) => latar.push(p) });
    const res = await respons!;
    await Promise.all(latar);
    return res;
  };
  return { ambil, simpanan };
}

describe("service worker", () => {
  it("gagal menyimpan cache tidak menggagalkan respons", async () => {
    const { ambil } = pasang({ putGagal: true });
    const res = await ambil("/api/hotspot/1");
    expect(res.ok).toBe(true);
    expect(await res.text()).toBe("isi");
  });

  it("aset statis dipangkas ke 60 entri terbaru", async () => {
    const { ambil, simpanan } = pasang();
    for (let i = 0; i < 70; i++) await ambil(`/_next/static/chunks/${i}.js`);
    const statis = [...simpanan.entries()].find(([nama]) => nama.endsWith("-statis"))![1];
    expect(statis.size).toBe(60);
    expect(statis.has(`${ASAL}/_next/static/chunks/69.js`)).toBe(true);
    expect(statis.has(`${ASAL}/_next/static/chunks/0.js`)).toBe(false);
  });
});
