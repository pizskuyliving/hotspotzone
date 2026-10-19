// Service worker hotspotzone.id: agar tampilan dan data terakhir tetap bisa
// dibuka saat sinyal hilang. Ganti VERSI bila strategi cache diubah.
const VERSI = "hotspotzone-v3";
// Aset /_next/static/ berganti nama tiap deploy; cache terpisah ini dipangkas
// agar file deploy lama tidak menumpuk di HP pengunjung.
const STATIS = `${VERSI}-statis`;
const MAKS_STATIS = 60;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((kunci) => Promise.all(kunci.filter((k) => k !== VERSI && k !== STATIS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Simpan salinan di latar belakang. Gagal menyimpan (kuota penuh, mode privat)
// tidak boleh menggagalkan respons yang sudah berhasil diambil. Hanya respons
// sukses: halaman tantangan firewall (403) atau galat tidak ikut tersimpan.
function simpanLatar(e, req, res, nama = VERSI, maks = Infinity) {
  if (res.ok && res.type === "basic") {
    const salinan = res.clone();
    e.waitUntil(
      caches
        .open(nama)
        .then(async (c) => {
          await c.put(req, salinan);
          // keys() berurutan dari yang tersimpan paling awal.
          const k = await c.keys();
          await Promise.all(k.slice(0, Math.max(0, k.length - maks)).map((x) => c.delete(x)));
        })
        .catch(() => {}),
    );
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Tile peta dan citra satelit (domain lain) tidak disimpan: terlalu besar.
  if (url.origin !== self.location.origin) return;

  // Aset Next.js bernama hash, isinya tidak pernah berubah: cache dulu.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches
        .match(req)
        .catch(() => undefined)
        .then((ada) => ada ?? fetch(req).then((res) => simpanLatar(e, req, res, STATIS, MAKS_STATIS))),
    );
    return;
  }

  // Halaman dan data: jaringan dulu agar selalu terbaru, cache hanya saat offline.
  e.respondWith(
    fetch(req).then(
      (res) => simpanLatar(e, req, res),
      async () => {
        const ada = (await caches.match(req)) ?? (req.mode === "navigate" ? await caches.match("/", { ignoreSearch: true }) : undefined);
        return ada ?? Response.error();
      },
    ),
  );
});
