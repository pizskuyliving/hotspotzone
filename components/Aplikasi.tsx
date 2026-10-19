"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { YAKIN_TINGGI, type ResponsAqi, type ResponsHotspot, type ResponsSumberAqi, type ResponsTren, type ResponsUdara } from "@/lib/tipe";
import { tanggalCitraDefault } from "@/lib/gibs";
import { LAPISAN_BAWAAN, bacaTautan, slug, tulisTautan, type KunciLapisan } from "@/lib/tautan";
import Panel from "./Panel";
import type { PetaHandle } from "./Peta";

const INTERVAL_PANTAU = 10 * 60 * 1000;

const Peta = dynamic(() => import("./Peta"), { ssr: false });

export type Lapisan = Record<KunciLapisan, boolean>;

export type Filter = { hanyaYakin: boolean };

async function ambilJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export default function Aplikasi() {
  const [hari, setHari] = useState(1);
  const [tanggal, setTanggal] = useState(() => tanggalCitraDefault());
  const [lapisan, setLapisan] = useState<Lapisan>(LAPISAN_BAWAAN);
  const [filter, setFilter] = useState<Filter>({ hanyaYakin: false });
  const [prov, setProv] = useState<string | null>(null); // slug provinsi terpilih
  const [hotspot, setHotspot] = useState<ResponsHotspot | null>(null);
  const [udara, setUdara] = useState<ResponsUdara | null>(null);
  const [aqi, setAqi] = useState<ResponsAqi | null>(null);
  const [tren, setTren] = useState<ResponsTren | null>(null);
  const [sumberAqi, setSumberAqi] = useState<ResponsSumberAqi | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [peta, setPeta] = useState<PetaHandle | null>(null);
  // URL dibaca setelah hydration (server tidak tahu query string), lalu baru data dimuat.
  const [urlDibaca, setUrlDibaca] = useState(false);
  const terbangAwal = useRef(false);

  const [dicek, setDicek] = useState<Date | null>(null);

  useEffect(() => {
    const s = bacaTautan(window.location.search);
    setHari(s.hari);
    setLapisan(s.lapisan);
    setFilter({ hanyaYakin: s.hanyaYakin });
    setProv(s.prov);
    if (s.tanggal) setTanggal(s.tanggal);
    terbangAwal.current = !s.prov; // tidak ada provinsi di link: tidak perlu terbang
    setUrlDibaca(true);
    // Hanya di produksi: di dev, cache service worker mengganggu hot reload.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (!urlDibaca) return;
    const cari = tulisTautan({ hari, prov, lapisan, hanyaYakin: filter.hanyaYakin, tanggal: tanggal === tanggalCitraDefault() ? null : tanggal });
    window.history.replaceState(null, "", `${window.location.pathname}${cari}`);
  }, [urlDibaca, hari, prov, lapisan, filter, tanggal]);

  const hariRef = useRef(hari);
  hariRef.current = hari;

  // diam = pembaruan otomatis di latar: data lama tetap tampil, tanpa indikator memuat.
  // Jawaban untuk rentang yang sudah tidak dipilih (datang belakangan) diabaikan.
  const muatHotspot = useCallback(async (h: number, diam = false) => {
    if (!diam) setMemuat(true);
    try {
      const data = await ambilJson<ResponsHotspot>(`/api/hotspot/${h}`);
      if (h !== hariRef.current) return;
      setHotspot(data);
      setGalat(null);
      setDicek(new Date());
    } catch {
      if (!diam && h === hariRef.current) setGalat("Data titik api belum bisa dimuat. Coba lagi sebentar.");
    } finally {
      if (!diam && h === hariRef.current) setMemuat(false);
    }
  }, []);

  const muatUdara = useCallback(() => {
    ambilJson<ResponsUdara>("/api/udara").then(setUdara).catch(() => {});
    ambilJson<ResponsAqi>("/api/aqi").then(setAqi).catch(() => {});
    ambilJson<ResponsTren>("/api/tren").then(setTren).catch(() => {});
  }, []);

  useEffect(() => {
    if (urlDibaca) muatHotspot(hari);
  }, [urlDibaca, hari, muatHotspot]);

  useEffect(muatUdara, [muatUdara]);
  // Sumber asli stasiun hanya berubah harian: cukup dimuat sekali, tidak ikut pemantauan 10 menit.
  useEffect(() => {
    ambilJson<ResponsSumberAqi>("/api/aqi/sumber").then(setSumberAqi).catch(() => {});
  }, []);

  // Pemantauan otomatis: muat ulang tiap 10 menit, dan langsung saat tab
  // dibuka lagi setelah lama ditinggal (misalnya HP baru dibuka kuncinya).
  useEffect(() => {
    const segarkan = () => {
      muatHotspot(hari, true);
      muatUdara();
    };
    const jeda = setInterval(() => {
      if (document.visibilityState === "visible") segarkan();
    }, INTERVAL_PANTAU);
    const saatTerlihat = () => {
      if (document.visibilityState === "visible" && dicekRef.current && Date.now() - dicekRef.current.getTime() > INTERVAL_PANTAU) segarkan();
    };
    document.addEventListener("visibilitychange", saatTerlihat);
    return () => {
      clearInterval(jeda);
      document.removeEventListener("visibilitychange", saatTerlihat);
    };
  }, [hari, muatHotspot, muatUdara]);

  const dicekRef = useRef(dicek);
  dicekRef.current = dicek;

  // Indeks provinsi terpilih di daftar provinsi respons; -1 = semua.
  const iProv = useMemo(() => (prov ? (hotspot?.provinsi.findIndex((p) => slug(p.nama) === prov) ?? -1) : -1), [hotspot, prov]);
  const namaProv = iProv >= 0 ? hotspot!.provinsi[iProv].nama : null;

  // Link dengan provinsi: terbang ke sana sekali, setelah peta dan data siap.
  useEffect(() => {
    if (terbangAwal.current || !peta || iProv < 0) return;
    terbangAwal.current = true;
    peta.terbangKeBbox(hotspot!.provinsi[iProv].bbox);
  }, [peta, hotspot, iProv]);

  // Peta menampilkan semua titik, termasuk negara tetangga (asap lintas batas);
  // panel hanya menghitung Indonesia, atau provinsi terpilih.
  const titikPeta = useMemo(() => {
    const semua = hotspot?.titik ?? [];
    return filter.hanyaYakin ? semua.filter((t) => t[3] === YAKIN_TINGGI) : semua;
  }, [hotspot, filter]);
  const titikWilayah = useMemo(() => {
    const semua = hotspot?.titik ?? [];
    return iProv >= 0 ? semua.filter((t) => t[7] === iProv) : semua.filter((t) => t[7] >= 0);
  }, [hotspot, iProv]);
  const jumlahTampil = useMemo(
    () => (filter.hanyaYakin ? titikWilayah.filter((t) => t[3] === YAKIN_TINGGI).length : titikWilayah.length),
    [titikWilayah, filter],
  );

  const pilihProv = (nama: string | null) => {
    setProv(nama ? slug(nama) : null);
    const p = nama ? hotspot?.provinsi.find((x) => x.nama === nama) : null;
    if (p) peta?.terbangKeBbox(p.bbox);
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <Peta
        titik={titikPeta}
        satelit={hotspot?.satelit ?? []}
        provinsi={hotspot?.provinsi ?? []}
        udara={udara?.kota ?? []}
        stasiun={aqi?.stasiun ?? []}
        sumberAqi={sumberAqi?.stasiun ?? {}}
        lapisan={lapisan}
        tanggal={tanggal}
        onSiap={setPeta}
      />
      <Panel
        hotspot={hotspot}
        titikWilayah={titikWilayah}
        jumlahTampil={jumlahTampil}
        namaProv={namaProv}
        pilihProv={pilihProv}
        tren={tren}
        udara={udara}
        aqi={aqi}
        memuat={memuat}
        galat={galat}
        hari={hari}
        setHari={setHari}
        tanggal={tanggal}
        setTanggal={setTanggal}
        lapisan={lapisan}
        setLapisan={setLapisan}
        filter={filter}
        setFilter={setFilter}
        dicek={dicek}
        muatUlang={() => {
          muatHotspot(hari);
          muatUdara();
        }}
        peta={peta}
      />
    </main>
  );
}
