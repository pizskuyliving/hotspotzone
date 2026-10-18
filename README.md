# hotspotzone.id

Peta titik api (hotspot), sebaran asap, dan kualitas udara (AQI) di seluruh Indonesia.
Data langsung dari satelit NASA, diperbarui otomatis. Situs non-komersial.

## Isi

- **Titik api**: NASA FIRMS, tiga satelit VIIRS (Suomi NPP, NOAA-20, NOAA-21), 24/48/72 jam.
  Ada rincian validitas (keyakinan tinggi/sedang/rendah), jumlah per satelit dan per provinsi.
- **Citra satelit & peta asap**: NASA GIBS (VIIRS True Color dan MODIS MAIAC Aerosol Optical Depth), bisa pilih tanggal.
- **Kualitas udara**: model CAMS dari Open-Meteo untuk 40 kota (tanpa key), ditambah stasiun darat WAQI kalau `WAQI_TOKEN` diisi.
- **Arah asap**: panah angin di sekitar penanda AQI menunjukkan ke mana asap terbawa.
- **Pemantauan otomatis**: browser memuat ulang data tiap 10 menit dan saat tab dibuka lagi.

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
`/api/aqi` tiap 10 menit, `/api/udara` tiap jam. Jadi FIRMS dan Open-Meteo tetap dipanggil jarang
walaupun pengunjungnya banyak.

## Struktur

```
app/api/hotspot/[hari]/route.ts   FIRMS -> titik ringkas + ringkasan provinsi
app/api/udara/route.ts            Open-Meteo: AQI, PM2.5, PM10, angin per kota
app/api/aqi/route.ts              Stasiun WAQI (opsional)
components/Peta.tsx               Peta MapLibre + layer GIBS
components/Panel.tsx              Panel desktop / bottom sheet HP
lib/                              Pengambil data, kategori AQI, kota, provinsi
data/provinsi.json                Batas provinsi (BAKOSURTANAL, versi sederhana)
lib/situs.ts                      Nama, deskripsi, dan URL situs (SEO, robots, sitemap)
app/opengraph-image.tsx           Gambar pratinjau saat link dibagikan
lib/*.test.ts                     Tes unit (Vitest)
scripts/salin-worker.mjs          Menyalin worker MapLibre ke public/ saat dev/build
```

## Catatan

- Titik api adalah anomali panas yang dideteksi satelit, belum tentu kebakaran. Data masuk FIRMS sekitar 3 jam setelah satelit melintas, jadi sifatnya near real-time.
- Batas provinsi memakai 32 wilayah lama: Kalimantan Utara digabung ke Kalimantan Timur, Kepulauan Riau ke Riau, Sulawesi Barat ke Sulawesi Selatan, dan provinsi pemekaran Papua menjadi "Papua"/"Papua Barat". Ganti `data/provinsi.json` dengan batas terbaru bila ingin 38 provinsi.
- Nama layer asap ada di `lib/gibs.ts`. Kalau layer "Peta asap" kosong padahal hari cerah, cek nama layer di https://worldview.earthdata.nasa.gov lalu sesuaikan.
- Syarat data: Open-Meteo gratis untuk non-komersial (CC BY 4.0), WAQI wajib atribusi dan tidak boleh untuk layanan berbayar. Atribusi sudah tercantum di peta dan kaki panel.
