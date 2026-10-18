"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { YAKIN_TINGGI, type ResponsAqi, type ResponsHotspot, type ResponsUdara } from "@/lib/tipe";
import { tanggalCitraDefault } from "@/lib/gibs";
import Panel from "./Panel";
import type { PetaHandle } from "./Peta";

const INTERVAL_PANTAU = 10 * 60 * 1000;

const Peta = dynamic(() => import("./Peta"), { ssr: false });

export type Lapisan = {
  titik: boolean;
  aqi: boolean;
  angin: boolean;
  truecolor: boolean;
  aod: boolean;
};

export type Filter = { hanyaYakin: boolean };

async function ambilJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export default function Aplikasi() {
  const [hari, setHari] = useState(1);
  const [tanggal, setTanggal] = useState(() => tanggalCitraDefault());
  const [lapisan, setLapisan] = useState<Lapisan>({ titik: true, aqi: true, angin: true, truecolor: false, aod: false });
  const [filter, setFilter] = useState<Filter>({ hanyaYakin: false });
  const [hotspot, setHotspot] = useState<ResponsHotspot | null>(null);
  const [udara, setUdara] = useState<ResponsUdara | null>(null);
  const [aqi, setAqi] = useState<ResponsAqi | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [peta, setPeta] = useState<PetaHandle | null>(null);

  const [dicek, setDicek] = useState<Date | null>(null);

  // diam = pembaruan otomatis di latar: data lama tetap tampil, tanpa indikator memuat.
  const muatHotspot = useCallback(async (h: number, diam = false) => {
    if (!diam) setMemuat(true);
    try {
      setHotspot(await ambilJson<ResponsHotspot>(`/api/hotspot/${h}`));
      setGalat(null);
      setDicek(new Date());
    } catch {
      if (!diam) setGalat("Data titik api belum bisa dimuat. Coba lagi sebentar.");
    } finally {
      if (!diam) setMemuat(false);
    }
  }, []);

  const muatUdara = useCallback(() => {
    ambilJson<ResponsUdara>("/api/udara").then(setUdara).catch(() => {});
    ambilJson<ResponsAqi>("/api/aqi").then(setAqi).catch(() => {});
  }, []);

  useEffect(() => {
    muatHotspot(hari);
  }, [hari, muatHotspot]);

  useEffect(muatUdara, [muatUdara]);

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

  const titikTampil = useMemo(() => {
    const semua = hotspot?.titik ?? [];
    return filter.hanyaYakin ? semua.filter((t) => t[3] === YAKIN_TINGGI) : semua;
  }, [hotspot, filter]);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <Peta
        titik={titikTampil}
        satelit={hotspot?.satelit ?? []}
        udara={udara?.kota ?? []}
        stasiun={aqi?.stasiun ?? []}
        lapisan={lapisan}
        tanggal={tanggal}
        onSiap={setPeta}
      />
      <Panel
        hotspot={hotspot}
        jumlahTampil={titikTampil.length}
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
