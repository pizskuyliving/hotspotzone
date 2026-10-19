"use client";

import { useEffect, useRef } from "react";
import {
  GeolocateControl,
  Map as PetaMaplibre,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type PointLike,
  type RasterTileSource,
  setWorkerUrl,
} from "maplibre-gl";
import { KEYAKINAN, waktuTitik, type Bbox, type StasiunAqi, type SumberAqi, type TitikApi, type UdaraKota } from "@/lib/tipe";
import { formatJam, teksDiukur, zonaWaktu, type Zona } from "@/lib/zona";
import { EKSPRESI_WARNA_AQI, kategoriAqi } from "@/lib/aqi";
import { LAYER_CITRA, urlWms } from "@/lib/gibs";
import type { Lapisan } from "./Aplikasi";

export type PetaHandle = {
  terbangKeBbox: (bbox: [number, number, number, number]) => void;
  terbangKe: (lon: number, lat: number, zoom?: number) => void;
};

type Props = {
  titik: TitikApi[];
  satelit: string[];
  provinsi: { nama: string; bbox: Bbox }[];
  udara: UdaraKota[];
  stasiun: StasiunAqi[];
  sumberAqi: Record<string, SumberAqi[]>;
  lapisan: Lapisan;
  tanggal: string;
  onSiap: (h: PetaHandle) => void;
};

setWorkerUrl("/maplibre-gl-worker.mjs");

const GAYA_TERANG = "https://tiles.openfreemap.org/styles/positron";
const GAYA_GELAP = "https://tiles.openfreemap.org/styles/dark";
// Cadangan bila peta dasar OpenFreeMap gagal dimuat: latar polos, data tetap tampil.
const GAYA_CADANGAN = (gelap: boolean) => ({
  version: 8 as const,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {},
  layers: [{ id: "latar", type: "background" as const, paint: { "background-color": gelap ? "#1b1d22" : "#e4e9ec" } }],
});
const BATAS_INDONESIA: [[number, number], [number, number]] = [[94, -11.5], [141.5, 6.5]];

const LAYER_TITIK = ["titik-panas", "titik-pendar", "titik-inti"];
// Peralihan heatmap -> titik individual.
const ZOOM_TITIK = 5;
const LAYER_UDARA = ["udara-lingkar", "udara-angka"];
const LAYER_STASIUN = ["stasiun-lingkar", "stasiun-angka"];

const kosong = (): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features: [] });

function geojsonTitik(titik: TitikApi[], satelit: string[], provinsi: { nama: string }[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: titik.map(([lon, lat, frp, conf, waktu, sat, malam, prov]) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: { frp, conf: KEYAKINAN[conf], waktu, sat: satelit[sat] ?? "?", dn: malam ? "N" : "D", prov: provinsi[prov]?.nama ?? "" },
    })),
  };
}

function geojsonUdara(kota: UdaraKota[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: kota.map((k) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [k.lon, k.lat] },
      properties: {
        ...k,
        aqi: k.aqi ?? -1,
        // Angin dilaporkan sebagai arah datang; panah menunjuk arah tujuan (arah asap terbawa).
        tujuan: k.anginArah == null ? 0 : (k.anginArah + 180) % 360,
        adaAngin: k.anginArah != null,
      },
    })),
  };
}

function geojsonStasiun(stasiun: StasiunAqi[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stasiun.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: { ...s },
    })),
  };
}

// Ikon panah angin: chevron di tepi lingkaran yang berputar mengelilingi penanda AQI.
function ikonPanah(gelap: boolean) {
  const s = 72;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  g.translate(s / 2, s / 2);
  g.strokeStyle = gelap ? "rgba(140,200,255,0.95)" : "rgba(20,90,170,0.95)";
  g.fillStyle = g.strokeStyle;
  g.lineWidth = 3.5;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(0, -17);
  g.lineTo(0, -27);
  g.stroke();
  g.beginPath();
  g.moveTo(0, -35);
  g.lineTo(-7, -25);
  g.lineTo(7, -25);
  g.closePath();
  g.fill();
  return g.getImageData(0, 0, s, s);
}

const LABEL_KEYAKINAN: Record<string, string> = { tinggi: "Tinggi", sedang: "Sedang", rendah: "Rendah" };

function esc(s: unknown) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function arahMataAngin(derajat: number) {
  const nama = ["utara", "timur laut", "timur", "tenggara", "selatan", "barat daya", "barat", "barat laut"];
  return nama[Math.round(derajat / 45) % 8];
}

function htmlTitik(f: MapGeoJSONFeature) {
  const p = f.properties as { frp: number; conf: string; waktu: number; sat: string; dn: string; prov: string };
  const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
  // Jam ditampilkan dalam zona waktu lokasi titik api (WIB/WITA/WIT).
  const zona = zonaWaktu(p.prov, lon);
  return `
    <div style="font-size:13px;line-height:1.5">
      <div style="font-weight:700;font-size:15px;margin-bottom:4px">🔥 Titik api</div>
      <div>${esc(formatJam(waktuTitik(Number(p.waktu)), zona))} · ${p.dn === "N" ? "malam" : "siang"}</div>
      <div>${p.prov ? esc(p.prov) : '<span style="color:var(--muted)">Di luar wilayah Indonesia</span>'}</div>
      <div>Keyakinan: <b>${esc(LABEL_KEYAKINAN[p.conf] ?? p.conf)}</b></div>
      <div>Daya radiasi api: <b>${Number(p.frp) < 1 ? "&lt;1" : esc(Number(p.frp))} MW</b></div>
      <div style="color:var(--muted)">Satelit ${esc(p.sat)} · ${lat.toFixed(3)}, ${lon.toFixed(3)}</div>
      <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600">Buka di Google Maps</a>
    </div>`;
}

function htmlUdara(f: MapGeoJSONFeature) {
  const p = f.properties as Record<string, unknown>;
  const aqi = Number(p.aqi);
  const k = kategoriAqi(aqi >= 0 ? aqi : null);
  const angin =
    p.anginArah != null && p.anginArah !== "null"
      ? `Angin ${Number(p.anginKecepatan).toFixed(0)} km/jam dari ${arahMataAngin(Number(p.anginArah))}, asap terbawa ke ${arahMataAngin((Number(p.anginArah) + 180) % 360)}`
      : "Data angin belum tersedia";
  return `
    <div style="font-size:13px;line-height:1.5">
      <div style="font-weight:700;font-size:15px">${esc(p.kota)}</div>
      <div style="display:flex;align-items:center;gap:8px;margin:6px 0">
        <span style="background:${k.warna};color:#fff;font-weight:700;border-radius:8px;padding:2px 8px">${aqi >= 0 ? aqi : "–"}</span>
        <span>${esc(k.label)}</span>
      </div>
      <div>PM2.5: <b>${p.pm25 != null && p.pm25 !== "null" ? Number(p.pm25).toFixed(1) : "–"}</b> µg/m³ · PM10: ${p.pm10 != null && p.pm10 !== "null" ? Number(p.pm10).toFixed(0) : "–"}</div>
      <div>${esc(angin)}</div>
      <div style="margin-top:6px;font-weight:600">Perkiraan model</div>
      <div style="color:var(--muted);font-size:11px">CAMS via Open-Meteo, bukan hasil ukur stasiun</div>
      <a href="${URL_ISPU}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-weight:600">Cek data resmi ISPU</a>
    </div>`;
}

// Situs resmi Indeks Standar Pencemar Udara (KLH). Alamat lama ispu.menlhk.go.id sudah tidak menjawab.
const URL_ISPU = "https://ispu.kemenlh.go.id/";
// Cadangan bila sumber asli stasiun belum termuat atau gagal diambil.
const SUMBER_WAQI: SumberAqi[] = [{ nama: "World Air Quality Index Project", url: "https://waqi.info/" }];

function htmlStasiun(f: MapGeoJSONFeature, sumberAqi: Record<string, SumberAqi[]>) {
  const p = f.properties as Record<string, unknown>;
  const k = kategoriAqi(Number(p.aqi));
  // Respons lama (cache offline) belum punya zona: perkiraan dari bujur.
  const zona = (p.zona as Zona | undefined) ?? zonaWaktu(null, (f.geometry as GeoJSON.Point).coordinates[0]);
  const diukur = teksDiukur(p.waktu as string | null, zona);
  // URL sudah disaring http(s) di server (lib/waqi.ts); tetap di-escape untuk atribut.
  const sumber = (sumberAqi[String(p.uid)] ?? SUMBER_WAQI)
    .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">${esc(s.nama)}</a>`)
    .join(" · ");
  return `
    <div style="font-size:13px;line-height:1.5">
      <div style="font-weight:700;font-size:14px">${esc(p.nama)}</div>
      <div style="display:flex;align-items:center;gap:8px;margin:6px 0">
        <span style="background:${k.warna};color:#fff;font-weight:700;border-radius:8px;padding:2px 8px">${esc(p.aqi)}</span>
        <span>${esc(k.label)}</span>
      </div>
      ${diukur ? `<div style="color:var(--muted)">${esc(diukur)}</div>` : ""}
      <div style="margin-top:6px;font-weight:600">Stasiun ukur darat</div>
      <div style="font-size:11px">Sumber: ${sumber}</div>
    </div>`;
}

export default function Peta({ titik, satelit, provinsi, udara, stasiun, sumberAqi, lapisan, tanggal, onSiap }: Props) {
  const wadah = useRef<HTMLDivElement>(null);
  const petaRef = useRef<PetaMaplibre | null>(null);
  const siap = useRef(false);
  const terakhir = useRef({ titik, satelit, provinsi, udara, stasiun, sumberAqi, lapisan, tanggal });
  terakhir.current = { titik, satelit, provinsi, udara, stasiun, sumberAqi, lapisan, tanggal };

  useEffect(() => {
    if (!wadah.current) return;
    const gelap = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const sempit = window.innerWidth < 768;
    const peta = new PetaMaplibre({
      container: wadah.current,
      style: gelap ? GAYA_GELAP : GAYA_TERANG,
      bounds: BATAS_INDONESIA,
      minZoom: 2,
      maxZoom: 14,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    peta.touchZoomRotate.disableRotation();
    peta.addControl(new NavigationControl({ showCompass: false }), sempit ? "top-right" : "bottom-right");
    peta.addControl(
      new GeolocateControl({ positionOptions: { enableHighAccuracy: false }, fitBoundsOptions: { maxZoom: 9 } }),
      sempit ? "top-right" : "bottom-right",
    );
    petaRef.current = peta;

    // Gaya OpenFreeMap merujuk ikon yang tidak ada di sprite-nya (misalnya
    // "circle-11"); isi dengan gambar transparan agar tidak memenuhi console.
    peta.setMissingStyleImageResolver((id) => {
      if (!peta.hasImage(id)) peta.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    let cadangan = false;
    peta.on("error", (e) => {
      const url = (e.error as { url?: string } | undefined)?.url ?? "";
      if (!cadangan && !peta.isStyleLoaded() && url.includes("/styles/")) {
        cadangan = true;
        peta.setStyle(GAYA_CADANGAN(gelap));
      }
    });

    peta.once("style.load", () => {
      peta.fitBounds(BATAS_INDONESIA, {
        padding: sempit ? { top: 90, bottom: 250, left: 4, right: 4 } : { top: 40, bottom: 40, left: 420, right: 40 },
        animate: false,
      });
      // Atribusi dimulai dalam bentuk ringkas (ikon i); teks lengkap ada di kaki panel.
      peta.once("idle", () =>
        peta.getContainer().querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show"),
      );
      const labelPertama = peta.getStyle().layers.find((l) => l.type === "symbol")?.id;

      for (const l of LAYER_CITRA) {
        peta.addSource(`gibs-${l.id}`, {
          type: "raster",
          tiles: [urlWms(l, terakhir.current.tanggal)],
          tileSize: 256,
          attribution: "Citra: NASA GIBS / Worldview",
        });
        peta.addLayer(
          { id: `gibs-${l.id}`, type: "raster", source: `gibs-${l.id}`, paint: { "raster-opacity": l.opasitas }, layout: { visibility: "none" } },
          labelPertama,
        );
      }

      peta.addImage("panah", ikonPanah(gelap), { pixelRatio: 2 });

      peta.addSource("titik", { type: "geojson", data: kosong(), attribution: "Titik api: NASA FIRMS" });
      // Zoom jauh: heatmap (lebih ringan dan lebih mudah dibaca daripada puluhan ribu titik).
      // Satu rona oranye, terang -> gelap = makin rapat; bobot dari keyakinan deteksi.
      peta.addLayer({
        id: "titik-panas",
        type: "heatmap",
        source: "titik",
        maxzoom: ZOOM_TITIK + 1.5,
        paint: {
          "heatmap-weight": ["match", ["get", "conf"], "tinggi", 1, "sedang", 0.6, 0.3],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.5, ZOOM_TITIK + 1.5, 1.6],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 5, ZOOM_TITIK + 1.5, 16],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(253,208,162,0)",
            0.15, "rgba(253,208,162,0.7)",
            0.4, "#fd8d3c",
            0.7, "#e6550d",
            1, "#a63603",
          ],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], ZOOM_TITIK, 0.9, ZOOM_TITIK + 1.5, 0],
        },
      });
      peta.addLayer({
        id: "titik-pendar",
        type: "circle",
        source: "titik",
        minzoom: ZOOM_TITIK,
        paint: {
          "circle-color": "#ff5a1f",
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], ZOOM_TITIK, 0, ZOOM_TITIK + 1, 0.22],
          "circle-blur": 1,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 5, 7, 10, 12, 22],
        },
      });
      peta.addLayer({
        id: "titik-inti",
        type: "circle",
        source: "titik",
        minzoom: ZOOM_TITIK,
        paint: {
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], ZOOM_TITIK, 0, ZOOM_TITIK + 1, 1],
          "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], ZOOM_TITIK, 0, ZOOM_TITIK + 1, 1],
          "circle-color": ["match", ["get", "conf"], "tinggi", "#d7191c", "sedang", "#ff7b1c", "#ffc233"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.6, 7, 3.5, 12, 7],
          "circle-stroke-color": gelap ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 3, 0, 7, 0.8],
        },
      });

      peta.addSource("udara", { type: "geojson", data: kosong(), attribution: "Kualitas udara & angin: Open-Meteo (CAMS), CC BY 4.0" });
      peta.addLayer({
        id: "udara-angin",
        type: "symbol",
        source: "udara",
        filter: ["==", ["get", "adaAngin"], true],
        layout: {
          "icon-image": "panah",
          "icon-rotate": ["get", "tujuan"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.9, 8, 1.3],
        },
      });
      peta.addLayer({
        id: "udara-lingkar",
        type: "circle",
        source: "udara",
        filter: [">=", ["get", "aqi"], 0],
        paint: {
          "circle-color": EKSPRESI_WARNA_AQI as never,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 9, 8, 14],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
      peta.addLayer({
        id: "udara-angka",
        type: "symbol",
        source: "udara",
        filter: [">=", ["get", "aqi"], 0],
        layout: {
          "text-field": ["to-string", ["get", "aqi"]],
          "text-font": ["Noto Sans Bold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 9, 8, 12],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });

      peta.addSource("stasiun", { type: "geojson", data: kosong(), attribution: "Stasiun AQI: World Air Quality Index (waqi.info) & EPA asal" });
      peta.addLayer({
        id: "stasiun-lingkar",
        type: "circle",
        source: "stasiun",
        paint: {
          "circle-color": EKSPRESI_WARNA_AQI as never,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 6, 8, 11],
          "circle-stroke-color": gelap ? "#111" : "#1c1b19",
          "circle-stroke-width": 1.5,
        },
      });
      peta.addLayer({
        id: "stasiun-angka",
        type: "symbol",
        source: "stasiun",
        minzoom: 6,
        layout: { "text-field": ["to-string", ["get", "aqi"]], "text-font": ["Noto Sans Bold"], "text-size": 10 },
        paint: { "text-color": "#ffffff" },
      });

      // Area sentuh diperlebar agar titik kecil mudah diketuk di HP.
      peta.on("click", (e) => {
        const r = 12;
        const kotak: [PointLike, PointLike] = [
          [e.point.x - r, e.point.y - r],
          [e.point.x + r, e.point.y + r],
        ];
        const urutan: [string[], (f: MapGeoJSONFeature) => string][] = [
          [LAYER_STASIUN, (f) => htmlStasiun(f, terakhir.current.sumberAqi)],
          [LAYER_UDARA, htmlUdara],
          [["titik-inti"], htmlTitik],
        ];
        for (const [layer, html] of urutan) {
          const ada = layer.filter((l) => peta.getLayer(l) && peta.getLayoutProperty(l, "visibility") !== "none");
          if (!ada.length) continue;
          const f = peta.queryRenderedFeatures(kotak, { layers: ada })[0];
          if (f) {
            const koordinat = (f.geometry as GeoJSON.Point).coordinates as [number, number];
            new Popup({ maxWidth: "300px", offset: 12 }).setLngLat(koordinat).setHTML(html(f)).addTo(peta);
            return;
          }
        }
      });
      for (const l of [...LAYER_TITIK, ...LAYER_UDARA, ...LAYER_STASIUN]) {
        peta.on("mouseenter", l, () => (peta.getCanvas().style.cursor = "pointer"));
        peta.on("mouseleave", l, () => (peta.getCanvas().style.cursor = ""));
      }

      siap.current = true;
      terapkanSemua();
      onSiap({
        terbangKeBbox: (b) =>
          peta.fitBounds([[b[0], b[1]], [b[2], b[3]]], {
            padding: window.innerWidth < 768 ? { top: 90, bottom: 260, left: 30, right: 30 } : { top: 60, bottom: 60, left: 420, right: 60 },
            maxZoom: 9,
          }),
        terbangKe: (lon, lat, zoom = 9) => peta.flyTo({ center: [lon, lat], zoom }),
      });
    });

    return () => {
      siap.current = false;
      peta.remove();
      petaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function terapkanSemua() {
    const peta = petaRef.current;
    if (!peta || !siap.current) return;
    const { titik, satelit, provinsi, udara, stasiun, lapisan, tanggal } = terakhir.current;
    (peta.getSource("titik") as GeoJSONSource).setData(geojsonTitik(titik, satelit, provinsi));
    (peta.getSource("udara") as GeoJSONSource).setData(geojsonUdara(udara));
    (peta.getSource("stasiun") as GeoJSONSource).setData(geojsonStasiun(stasiun));
    const tampil = (id: string, ya: boolean) => peta.setLayoutProperty(id, "visibility", ya ? "visible" : "none");
    LAYER_TITIK.forEach((l) => tampil(l, lapisan.titik));
    LAYER_UDARA.forEach((l) => tampil(l, lapisan.aqi));
    LAYER_STASIUN.forEach((l) => tampil(l, lapisan.aqi));
    tampil("udara-angin", lapisan.angin);
    for (const l of LAYER_CITRA) {
      tampil(`gibs-${l.id}`, lapisan[l.id as keyof Lapisan]);
      const src = peta.getSource(`gibs-${l.id}`) as RasterTileSource | undefined;
      const url = urlWms(l, tanggal);
      if (src && src.tiles?.[0] !== url) src.setTiles([url]);
    }
  }

  useEffect(terapkanSemua, [titik, satelit, provinsi, udara, stasiun, lapisan, tanggal]);

  // Wadah luar yang diposisikan: CSS MapLibre memberi .maplibregl-map position: relative.
  return (
    <div className="absolute inset-0">
      <div ref={wadah} className="h-full w-full" aria-label="Peta titik api Indonesia" />
    </div>
  );
}
