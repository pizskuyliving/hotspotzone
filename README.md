# hotspotzone.id

Peta titik api (hotspot), sebaran asap, dan kualitas udara (AQI) di seluruh Indonesia.
Data langsung dari satelit NASA, diperbarui otomatis. Situs non-komersial.

## Isi

- **Titik api**: NASA FIRMS, tiga satelit VIIRS (Suomi NPP, NOAA-20, NOAA-21), 24/48/72 jam.
  Ada rincian validitas (keyakinan tinggi/sedang/rendah), jumlah per satelit dan per provinsi.
- **Citra satelit & peta asap**: NASA GIBS (VIIRS True Color dan MODIS MAIAC Aerosol Optical Depth), bisa pilih tanggal.
- **Kualitas udara**: model CAMS dari Open-Meteo untuk 40 kota (tanpa key), ditambah stasiun darat WAQI kalau `WAQI_TOKEN` diisi.
- **Arah asap**: panah angin di sekitar penanda AQI menunjukkan ke mana asap terbawa.
- **Pemantauan otomatis**: browser memuat ulang data tiap 10 menit dan saat tab dibuka lagi. Status di pojok menunjukkan umur data satelit terakhir (hijau ≤6 jam, kuning ≤14 jam, merah lebih lama).
- **38 provinsi**: angka per provinsi dan nasional hanya menghitung titik di dalam Indonesia; titik di Malaysia, Papua Nugini, dan Timor Leste tetap tampil di peta sebagai konteks asap lintas batas.
- **Tren 7 hari** per provinsi atau nasional (`/api/tren`, diperbarui tiap 3 jam).
- **Zona waktu lokal**: jam di popup titik api memakai WIB/WITA/WIT sesuai provinsinya.
- **Link yang bisa dibagikan**: `?hari=3&prov=kalimantan-tengah&lapisan=titik,aod&yakin=1&tgl=2026-10-15`.
- **Heatmap** di zoom jauh, titik individual mulai zoom 5.
- **PWA**: bisa dipasang di layar utama HP; halaman dan data terakhir tetap terbuka saat offline (`public/sw.js`).
- **Vercel Analytics**: aktifkan di dashboard Vercel (tab Analytics) agar statistik pengunjung terkumpul.

## Jalankan di komputer (Windows)

```bash
npm install
copy .env.example .env.local   # lalu isi FIRMS_MAP_KEY
npm run dev
```

Buka http://localhost:3000. Tanpa `FIRMS_MAP_KEY`, situs tetap jalan dengan data contoh (ada tanda "Mode contoh").

Pemeriksaan: `npm run lint` (tipe), `npm test` (tes unit), `npm run build`. Ketiganya juga dijalankan GitHub Actions di setiap push.

## Key yang dibutuhkan

| Variabel | Wajib? | Daftar di |
|---|---|---|
| `FIRMS_MAP_KEY` | Ya | https://firms.modaps.eosdis.nasa.gov/api/map_key (gratis, cukup email) |
| `WAQI_TOKEN` | Opsional | https://aqicn.org/data-platform/token/ (gratis, non-komersial) |

## Deploy ke Vercel

1. Buat repo GitHub baru (misalnya `hotspotzoneid`), lalu push folder ini.
2. Di https://vercel.com/new pilih repo tersebut. Framework otomatis terdeteksi sebagai Next.js.
3. Di **Environment Variables** isi `FIRMS_MAP_KEY` (dan `WAQI_TOKEN` bila ada).
4. Klik **Deploy**. Paket Hobby (gratis) cukup.

Tidak perlu cron. Rute API memakai ISR: `/api/hotspot/[1|2|3]` disegarkan paling sering tiap 15 menit,
`/api/aqi` tiap 10 menit, `/api/udara` tiap jam, `/api/tren` tiap 3 jam, `/api/aqi/sumber` tiap hari (~190 panggilan WAQI per hari). Jadi FIRMS dan Open-Meteo tetap dipanggil jarang
walaupun pengunjungnya banyak.

## Struktur

```
app/api/hotspot/[hari]/route.ts   FIRMS -> titik ringkas + ringkasan provinsi
app/api/udara/route.ts            Open-Meteo: AQI, PM2.5, PM10, angin per kota
app/api/aqi/route.ts              Stasiun WAQI (opsional)
app/api/aqi/sumber/route.ts       Sumber asli tiap stasiun WAQI (atribusi), untuk popup
components/Peta.tsx               Peta MapLibre + layer GIBS
components/Panel.tsx              Panel desktop / bottom sheet HP
lib/                              Pengambil data, kategori AQI, kota, provinsi
data/provinsi.json                Batas 38 provinsi (turunan OpenStreetMap, disederhanakan)
scripts/buat-provinsi.mjs         Membuat ulang data/provinsi.json dari GeoJSON OSM
data/tetangga.json                Daratan negara tetangga (Natural Earth, domain publik)
scripts/buat-tetangga.mjs         Membuat ulang data/tetangga.json
lib/situs.ts                      Nama, deskripsi, dan URL situs (SEO, robots, sitemap)
app/opengraph-image.tsx           Gambar pratinjau saat link dibagikan
lib/*.test.ts                     Tes unit (Vitest)
scripts/salin-worker.mjs          Menyalin worker MapLibre ke public/ saat dev/build
```

## Catatan

- Titik api adalah anomali panas yang dideteksi satelit, belum tentu kebakaran. Data masuk FIRMS sekitar 3 jam setelah satelit melintas, jadi sifatnya near real-time.
- Batas 38 provinsi berasal dari [kpu-osm-boundaries-2026](https://github.com/ahsa29/kpu-osm-boundaries-2026) (ekstrak OpenStreetMap 9 Oktober 2026), lisensi [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), © OpenStreetMap contributors. `data/provinsi.json` adalah turunan yang disederhanakan (toleransi ~1 km) dan ikut berlisensi ODbL. Cara membuat ulang ada di `scripts/buat-provinsi.mjs`.
- Nama layer asap ada di `lib/gibs.ts`. Kalau layer "Peta asap" kosong padahal hari cerah, cek nama layer di https://worldview.earthdata.nasa.gov lalu sesuaikan.
- Syarat data: Open-Meteo gratis untuk non-komersial (CC BY 4.0), WAQI wajib atribusi dan tidak boleh untuk layanan berbayar. Atribusi sudah tercantum di peta dan kaki panel.
