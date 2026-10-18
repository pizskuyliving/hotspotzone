// Citra satelit NASA GIBS lewat WMS (tanpa API key). WMS dipakai agar
// tidak perlu menebak tile matrix tiap layer; MapLibre mengisi {bbox-epsg-3857}.
const WMS = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi";

export type LayerCitra = {
  id: string;
  label: string;
  keterangan: string;
  layer: string;
  format: "image/jpeg" | "image/png";
  opasitas: number;
  // Berapa hari data layer ini tertinggal (UTC). MODIS MAIAC baru lengkap ~H+1.
  jedaHari: number;
};

export const LAYER_CITRA: LayerCitra[] = [
  {
    id: "truecolor",
    label: "Citra satelit (warna asli)",
    keterangan: "VIIRS NOAA-20. Asap tampak sebagai kabut abu-kecokelatan.",
    layer: "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
    format: "image/jpeg",
    opasitas: 1,
    jedaHari: 0,
  },
  {
    id: "aod",
    label: "Kepekatan aerosol (asap)",
    keterangan: "MODIS MAIAC Aerosol Optical Depth. Kuning-merah berarti asap/partikel pekat.",
    layer: "MODIS_Combined_MAIAC_L2G_AerosolOpticalDepth",
    format: "image/png",
    opasitas: 0.75,
    jedaHari: 1,
  },
];

// Tanggal yang benar-benar dipakai: tanggal terpilih, atau tanggal terbaru yang
// sudah tersedia bila layer ini tertinggal (agar peta asap tidak kosong).
export function tanggalLayer(l: LayerCitra, tanggal: string, sekarang = new Date()) {
  const d = new Date(sekarang);
  d.setUTCDate(d.getUTCDate() - l.jedaHari);
  const batas = d.toISOString().slice(0, 10);
  return tanggal > batas ? batas : tanggal;
}

export function urlWms(l: LayerCitra, tanggal: string) {
  const q = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: "1.3.0",
    LAYERS: l.layer,
    STYLES: "",
    FORMAT: l.format,
    TRANSPARENT: l.format === "image/png" ? "TRUE" : "FALSE",
    CRS: "EPSG:3857",
    WIDTH: "256",
    HEIGHT: "256",
    TIME: tanggalLayer(l, tanggal),
  });
  // {bbox-epsg-3857} tidak boleh di-encode.
  return `${WMS}?${q.toString()}&BBOX={bbox-epsg-3857}`;
}

// Satelit pagi melintasi Indonesia sekitar 03.00-07.00 UTC dan citranya
// masuk GIBS beberapa jam kemudian, jadi sebelum 09.00 UTC pakai kemarin.
export function tanggalCitraDefault(sekarang = new Date()) {
  const d = new Date(sekarang);
  if (d.getUTCHours() < 9) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
