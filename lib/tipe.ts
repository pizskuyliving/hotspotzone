// Satu titik api dikirim ke browser sebagai tuple angka agar respons kecil
// (data 72 jam di puncak musim karhutla bisa >60 ribu titik, sedangkan
// batas respons Vercel Function 4,5 MB).
// [bujur, lintang, frp (MW), keyakinan, waktu (menit sejak epoch UTC), indeks satelit, malam,
//  indeks provinsi (-1 di luar provinsi)]
export type TitikApi = [number, number, number, TingkatKeyakinan, number, number, 0 | 1, number];

export type Bbox = [number, number, number, number];

export const KEYAKINAN = ["rendah", "sedang", "tinggi"] as const;
export type Keyakinan = (typeof KEYAKINAN)[number];
export type TingkatKeyakinan = 0 | 1 | 2; // indeks ke KEYAKINAN
export const YAKIN_TINGGI: TingkatKeyakinan = 2;

export const waktuTitik = (menit: number) => new Date(menit * 60000);

export type RingkasanProvinsi = {
  nama: string;
  jumlah: number;
  tinggi: number; // jumlah titik berkeyakinan tinggi
  bbox: Bbox;
};

export type ResponsHotspot = {
  demo: boolean;
  hari: number;
  diperbarui: string;
  sumber: string[];
  gagal: string[];
  satelit: string[]; // nama satelit, dirujuk oleh indeks di TitikApi
  provinsi: { nama: string; bbox: Bbox }[]; // dirujuk oleh indeks provinsi di TitikApi
  titik: TitikApi[];
  ringkasan: RingkasanProvinsi[];
};

export type UdaraKota = {
  kota: string;
  lat: number;
  lon: number;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  anginKecepatan: number | null; // km/jam
  anginArah: number | null; // derajat, arah datangnya angin
};

export type ResponsUdara = {
  diperbarui: string;
  kota: UdaraKota[];
  gagal: boolean;
};

export type StasiunAqi = {
  uid: number;
  nama: string;
  lat: number;
  lon: number;
  aqi: number;
  waktu: string | null;
};

export type ResponsAqi = {
  aktif: boolean;
  diperbarui: string;
  stasiun: StasiunAqi[];
};

export type ResponsTren = {
  demo: boolean;
  diperbarui: string;
  gagal: string[];
  hari: string[]; // tanggal WIB, terlama ke terbaru; yang terakhir hari ini (belum lengkap)
  nasional: number[]; // jumlah deteksi per hari
  provinsi: Record<string, number[]>; // nama provinsi -> jumlah deteksi per hari
};
