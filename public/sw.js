// Service worker hotspotzone.id: agar tampilan dan data terakhir tetap bisa
// dibuka saat sinyal hilang. Ganti VERSI bila strategi cache diubah.
const VERSI = "hotspotzone-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((kunci) => Promise.all(kunci.filter((k) => k !== VERSI).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Simpan salinan di latar belakang. Gagal menyimpan (kuota penuh, mode privat)
// tidak boleh menggagalkan respons yang sudah berhasil diambil. Hanya respons
// sukses: halaman tantangan firewall (403) atau galat tidak ikut tersimpan.
function simpanLatar(e, req, res) {
  if (res.ok && res.type === "basic") {
    const salinan = res.clone();
    e.waitUntil(
      caches
        .open(VERSI)
        .then((c) => c.put(req, salinan))
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
        .then((ada) => ada ?? fetch(req).then((res) => simpanLatar(e, req, res))),
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
