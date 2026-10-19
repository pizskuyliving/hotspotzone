"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { KEYAKINAN, waktuTitik, type ResponsAqi, type ResponsHotspot, type ResponsTren, type ResponsUdara, type TitikApi } from "@/lib/tipe";
import { KATEGORI_AQI, kategoriAqi } from "@/lib/aqi";
import { LAYER_CITRA, tanggalLayer } from "@/lib/gibs";
import type { Filter, Lapisan } from "./Aplikasi";
import type { PetaHandle } from "./Peta";
import GrafikTren from "./GrafikTren";
import { formatJam } from "@/lib/zona";

type Props = {
  hotspot: ResponsHotspot | null;
  titikWilayah: TitikApi[]; // titik di provinsi terpilih (atau semua), sebelum filter keyakinan
  jumlahTampil: number;
  namaProv: string | null;
  pilihProv: (nama: string | null) => void;
  tren: ResponsTren | null;
  udara: ResponsUdara | null;
  aqi: ResponsAqi | null;
  memuat: boolean;
  galat: string | null;
  hari: number;
  setHari: (h: number) => void;
  tanggal: string;
  setTanggal: (t: string) => void;
  lapisan: Lapisan;
  setLapisan: (l: Lapisan) => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
  dicek: Date | null;
  muatUlang: () => void;
  peta: PetaHandle | null;
};

const RENTANG = [
  { hari: 1, label: "24 jam" },
  { hari: 2, label: "48 jam" },
  { hari: 3, label: "72 jam" },
];

const CHIP: { kunci: keyof Lapisan; label: string; ikon: string }[] = [
  { kunci: "titik", label: "Titik api", ikon: "🔥" },
  { kunci: "aqi", label: "AQI", ikon: "🌫️" },
  { kunci: "angin", label: "Arah asap", ikon: "🧭" },
  { kunci: "truecolor", label: "Citra satelit", ikon: "🛰️" },
  { kunci: "aod", label: "Peta asap", ikon: "💨" },
];

const fmtAngka = new Intl.NumberFormat("id-ID");

function relatif(d: Date | null, sekarang: number) {
  if (!d) return "memuat…";
  const menit = Math.floor((sekarang - d.getTime()) / 60000);
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  return `${Math.floor(menit / 60)} jam lalu`;
}

function tanggalLokal(offsetHari: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetHari);
  return d.toISOString().slice(0, 10);
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-xl bg-aksen text-base text-white">🔥</span>
      <span className="text-[17px] font-extrabold tracking-tight">
        hotspotzone<span className="text-aksen">.id</span>
      </span>
    </div>
  );
}

// Satelit melintas dua kali sehari dan datanya masuk ~3 jam kemudian, jadi
// jeda wajar sampai ~13 jam. Lebih dari itu kemungkinan FIRMS terlambat.
function warnaUsia(jam: number) {
  if (jam <= 6) return { titik: "bg-emerald-500", denyut: true };
  if (jam <= 14) return { titik: "bg-amber-500", denyut: false };
  return { titik: "bg-red-500", denyut: false };
}

function StatusData({ terbaru, dicek, sekarang, memuat, onMuat }: { terbaru: Date | null; dicek: Date | null; sekarang: number; memuat: boolean; onMuat: () => void }) {
  const w = warnaUsia(terbaru ? (sekarang - terbaru.getTime()) / 3600000 : 0);
  return (
    <button
      onClick={onMuat}
      className="flex min-h-9 shrink-0 items-center gap-2 rounded-full bg-chip px-3 text-xs font-medium whitespace-nowrap text-redup active:scale-95"
      aria-label={`Muat ulang data. Data satelit terakhir ${relatif(terbaru, sekarang)}, dicek ${relatif(dicek, sekarang)}.`}
      title={`Dicek ${relatif(dicek, sekarang)} · ketuk untuk muat ulang`}
    >
      <span className="relative flex size-2">
        {w.denyut && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${w.titik}`} />}
        <span className={`relative inline-flex size-2 rounded-full ${w.titik}`} />
      </span>
      <span>{memuat || !terbaru ? "Memuat…" : <><span className="hidden min-[400px]:max-md:inline">Data satelit </span><span className="min-[400px]:max-md:hidden">Satelit </span>{relatif(terbaru, sekarang)}</>}</span>
      <span aria-hidden className={memuat ? "animate-spin" : ""}>↻</span>
    </button>
  );
}

async function bagikan(judul: string): Promise<string> {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: judul, url });
    } catch {
      // dibatalkan pengguna
    }
    return "";
  }
  try {
    await navigator.clipboard.writeText(url);
    return "Link disalin";
  } catch {
    return "Salin link dari bilah alamat";
  }
}

export default function Panel(p: Props) {
  const [terbuka, setTerbuka] = useState(false);
  const [semuaProvinsi, setSemuaProvinsi] = useState(false);
  const [sekarang, setSekarang] = useState(() => Date.now());
  const [pesanBagikan, setPesanBagikan] = useState("");
  const tarik = useRef<number | null>(null);
  const isi = useRef<HTMLDivElement>(null);

  // Saat panel HP ditutup, kembali ke atas agar ringkasan utama yang terlihat.
  useEffect(() => {
    if (!terbuka) isi.current?.scrollTo({ top: 0 });
  }, [terbuka]);

  useEffect(() => {
    const t = setInterval(() => setSekarang(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const ringkasan = p.hotspot?.ringkasan ?? [];
  const provinsiTampil = semuaProvinsi ? ringkasan : ringkasan.slice(0, 6);
  const maksProvinsi = ringkasan[0]?.jumlah ?? 1;

  // Usia data dihitung dari deteksi terbaru se-Indonesia, bukan wilayah terpilih.
  const terbaru = useMemo(() => {
    let t = 0;
    for (const x of p.hotspot?.titik ?? []) if (x[4] > t) t = x[4];
    return t ? waktuTitik(t) : null;
  }, [p.hotspot]);
  const terbaruWilayah = useMemo(() => {
    let t = 0;
    for (const x of p.titikWilayah) if (x[4] > t) t = x[4];
    return t ? waktuTitik(t) : null;
  }, [p.titikWilayah]);

  // Rincian validitas: semua titik di wilayah terpilih (tidak terpengaruh filter keyakinan).
  const rincian = useMemo(() => {
    const r = { tinggi: 0, sedang: 0, rendah: 0, siang: 0, malam: 0, satelit: new Map<string, { jumlah: number; lintas: number }>() };
    for (const t of p.titikWilayah) {
      r[KEYAKINAN[t[3]]]++;
      if (t[6] === 1) r.malam++;
      else r.siang++;
      const nama = p.hotspot?.satelit[t[5]] ?? "?";
      const s = r.satelit.get(nama) ?? { jumlah: 0, lintas: 0 };
      s.jumlah++;
      if (t[4] > s.lintas) s.lintas = t[4];
      r.satelit.set(nama, s);
    }
    return r;
  }, [p.titikWilayah, p.hotspot]);
  const totalSemua = p.titikWilayah.length;

  const trenTampil = p.tren && (p.namaProv ? (p.tren.provinsi[p.namaProv] ?? p.tren.hari.map(() => 0)) : p.tren.nasional);

  const kotaTerburuk = useMemo(
    () => [...(p.udara?.kota ?? [])].filter((k) => k.aqi != null).sort((a, b) => b.aqi! - a.aqi!).slice(0, 5),
    [p.udara],
  );

  const citraAktif = p.lapisan.truecolor || p.lapisan.aod;
  const tutupDiHp = () => {
    if (window.innerWidth < 768) setTerbuka(false);
  };

  return (
    <>
      {/* Bilah atas khusus HP */}
      <header
        className="kaca bayangan fixed inset-x-3 z-20 flex items-center justify-between gap-2 rounded-2xl px-3 py-2 md:hidden"
        style={{ top: "max(12px, env(safe-area-inset-top))" }}
      >
        <Logo />
        <StatusData terbaru={terbaru} dicek={p.dicek} sekarang={sekarang} memuat={p.memuat} onMuat={p.muatUlang} />
      </header>

      <section
        className={`kaca bayangan fixed inset-x-0 bottom-0 z-20 max-md:bg-panel-solid flex flex-col rounded-t-3xl transition-[max-height] duration-300 ease-out
          md:inset-x-auto md:top-4 md:bottom-4 md:left-4 md:w-[380px] md:max-h-none md:rounded-3xl
          ${terbuka ? "max-h-[78dvh]" : "max-h-[236px]"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Panel informasi"
      >
        {/* Pegangan: ketuk atau geser untuk membuka/menutup di HP */}
        <button
          className="flex w-full shrink-0 touch-none flex-col items-center pt-2.5 pb-1 md:hidden"
          onClick={() => setTerbuka(!terbuka)}
          onPointerDown={(e) => (tarik.current = e.clientY)}
          onPointerUp={(e) => {
            if (tarik.current == null) return;
            const dy = e.clientY - tarik.current;
            tarik.current = null;
            if (dy < -25) setTerbuka(true);
            else if (dy > 25) setTerbuka(false);
          }}
          aria-expanded={terbuka}
          aria-label={terbuka ? "Tutup panel" : "Buka panel"}
        >
          <span className="h-1.5 w-11 rounded-full bg-garis" style={{ background: "var(--muted)", opacity: 0.4 }} />
        </button>

        <div className="hidden items-center justify-between gap-2 px-5 pt-5 md:flex">
          <Logo />
          <StatusData terbaru={terbaru} dicek={p.dicek} sekarang={sekarang} memuat={p.memuat} onMuat={p.muatUlang} />
        </div>

        <div ref={isi} className={`tanpa-scrollbar flex-1 overscroll-contain px-4 pb-4 md:overflow-y-auto md:px-5 ${terbuka ? "overflow-y-auto" : "overflow-hidden"}`}>
          {/* Ringkasan utama: selalu terlihat, juga saat panel HP tertutup */}
          <div className="flex items-end justify-between gap-3 pt-1 md:pt-4">
            <div>
              <div className="text-[11px] font-semibold tracking-wider text-redup uppercase">
                Titik api · {p.namaProv ?? "Indonesia"} · {RENTANG.find((r) => r.hari === p.hari)?.label}
              </div>
              <div className="text-4xl leading-tight font-extrabold tabular-nums">
                {p.hotspot ? fmtAngka.format(p.jumlahTampil) : "…"}
              </div>
            </div>
            {!terbuka && (
              <button onClick={() => setTerbuka(true)} className="min-h-10 rounded-full bg-aksen-lembut px-4 text-sm font-semibold text-aksen md:hidden">
                Detail
              </button>
            )}
          </div>
          <div className="mt-0.5 text-xs text-redup">
            {terbaruWilayah ? `Deteksi terbaru ${formatJam(terbaruWilayah, "WIB")}` : p.hotspot ? "Tidak ada deteksi" : " "}
            {!p.namaProv && ringkasan[0] && <> · terbanyak di <b className="text-teks">{ringkasan[0].nama}</b></>}
          </div>
          <div className={`mt-2 flex flex-wrap items-center gap-2 ${terbuka ? "" : "max-md:hidden"}`}>
            {p.namaProv && (
              <button
                onClick={() => p.pilihProv(null)}
                className="flex min-h-8 items-center gap-1.5 rounded-full bg-aksen-lembut px-3 text-xs font-semibold text-aksen"
                aria-label={`Hapus pilihan ${p.namaProv}, tampilkan seluruh Indonesia`}
              >
                {p.namaProv} <span aria-hidden>✕</span>
              </button>
            )}
            <button
              onClick={async () => {
                const pesan = await bagikan(`Titik api ${p.namaProv ?? "Indonesia"} · hotspotzone.id`);
                setPesanBagikan(pesan);
                if (pesan) setTimeout(() => setPesanBagikan(""), 2500);
              }}
              className="flex min-h-8 items-center gap-1.5 rounded-full border border-garis px-3 text-xs font-medium"
            >
              <span aria-hidden>↗</span> Bagikan tampilan ini
            </button>
            <span role="status" className="text-xs text-redup">{pesanBagikan}</span>
          </div>

          {p.hotspot?.demo && (
            <div className={`mt-2 rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 ${terbuka ? "" : "max-md:hidden"}`}>
              Mode contoh: FIRMS_MAP_KEY belum diisi, titik di peta adalah data acak.
            </div>
          )}
          {p.galat && <div className="mt-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs text-red-600 dark:text-red-300">{p.galat}</div>}
          {!!p.hotspot?.gagal.length && (
            <div className="mt-2 rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Sebagian satelit belum terambil ({p.hotspot.gagal.length} dari 3), angka bisa lebih rendah dari sebenarnya.
            </div>
          )}

          {/* Pilihan lapisan: chip besar yang mudah diketuk */}
          <div className="tanpa-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            {CHIP.map((c) => {
              const aktif = p.lapisan[c.kunci];
              return (
                <button
                  key={c.kunci}
                  onClick={() => p.setLapisan({ ...p.lapisan, [c.kunci]: !aktif })}
                  aria-pressed={aktif}
                  className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition active:scale-95 ${
                    aktif ? "border-transparent bg-teks text-bg" : "border-garis bg-transparent text-teks"
                  }`}
                >
                  <span aria-hidden>{c.ikon}</span>
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-chip p-1">
            {RENTANG.map((r) => (
              <button
                key={r.hari}
                onClick={() => p.setHari(r.hari)}
                className={`min-h-9 rounded-xl text-sm font-semibold transition ${p.hari === r.hari ? "bg-panel-solid shadow-sm" : "text-redup"}`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Rincian validitas data satelit */}
          {totalSemua > 0 && (
            <div className="mt-3 rounded-2xl border border-garis p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold">Validitas deteksi satelit</h2>
                <span className="text-xs text-redup">{fmtAngka.format(totalSemua)} titik</span>
              </div>
              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-chip" aria-hidden>
                {(
                  [
                    ["tinggi", "#d7191c"],
                    ["sedang", "#ff7b1c"],
                    ["rendah", "#ffc233"],
                  ] as const
                ).map(([k, w]) => (
                  <span key={k} style={{ width: `${(rincian[k] / totalSemua) * 100}%`, background: w }} />
                ))}
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ["tinggi", "Keyakinan tinggi", "#d7191c"],
                    ["sedang", "Sedang", "#ff7b1c"],
                    ["rendah", "Rendah", "#ffc233"],
                  ] as const
                ).map(([k, l, w]) => (
                  <div key={k} className="rounded-xl bg-chip px-1 py-1.5">
                    <dd className="text-lg leading-tight font-extrabold tabular-nums" style={{ color: k === "tinggi" ? w : undefined }}>
                      {fmtAngka.format(rincian[k])}
                    </dd>
                    <dt className="text-[11px] text-redup">
                      {l} · {Math.round((rincian[k] / totalSemua) * 100)}%
                    </dt>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[11px] leading-relaxed text-redup">
                Keyakinan tinggi berarti sinyal panas sangat kuat dan paling mungkin kebakaran nyata. Rendah bisa berupa pantulan atau panas permukaan.
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {[...rincian.satelit.entries()]
                  .sort((a, b) => b[1].jumlah - a[1].jumlah)
                  .map(([sat, s]) => (
                    <li key={sat} className="flex justify-between gap-2">
                      <span>
                        🛰️ {sat} <span className="text-redup">· lintas terakhir {formatJam(waktuTitik(s.lintas), "WIB")}</span>
                      </span>
                      <b className="tabular-nums">{fmtAngka.format(s.jumlah)}</b>
                    </li>
                  ))}
                <li className="flex justify-between gap-2 text-redup">
                  <span>Siang / malam</span>
                  <span className="tabular-nums">
                    {fmtAngka.format(rincian.siang)} / {fmtAngka.format(rincian.malam)}
                  </span>
                </li>
              </ul>
            </div>
          )}

          <label className="mt-3 flex min-h-10 cursor-pointer items-center justify-between gap-3 text-sm">
            <span>Hanya titik dengan keyakinan tinggi</span>
            <input
              type="checkbox"
              className="size-5 accent-[var(--accent)]"
              checked={p.filter.hanyaYakin}
              onChange={(e) => p.setFilter({ hanyaYakin: e.target.checked })}
            />
          </label>

          {citraAktif && (
            <div className="mt-3 rounded-2xl border border-garis p-3">
              <label className="flex items-center justify-between gap-3 text-sm font-semibold">
                Tanggal citra satelit
                <input
                  type="date"
                  value={p.tanggal}
                  min={tanggalLokal(-30)}
                  max={tanggalLokal(0)}
                  onChange={(e) => e.target.value && p.setTanggal(e.target.value)}
                  className="min-h-9 rounded-lg border border-garis bg-transparent px-2 text-sm"
                />
              </label>
              {LAYER_CITRA.filter((l) => p.lapisan[l.id as keyof Lapisan]).map((l) => (
                <p key={l.id} className="mt-2 text-xs text-redup">
                  <b className="text-teks">{l.label}.</b> {l.keterangan}
                  {tanggalLayer(l, p.tanggal) !== p.tanggal && ` Memakai data ${tanggalLayer(l, p.tanggal)}, data tanggal terpilih belum tersedia.`}
                </p>
              ))}
              <p className="mt-2 text-xs text-redup">Area kosong berarti satelit belum melintas atau tertutup awan.</p>
            </div>
          )}

          {trenTampil && (
            <>
              <h2 className="mt-5 mb-1 text-sm font-bold">Tren 7 hari · {p.namaProv ?? "Indonesia"}</h2>
              <p className="mb-6 text-[11px] text-redup">
                Jumlah deteksi per hari (WIB) dari ketiga satelit. Satu kebakaran bisa terdeteksi lebih dari sekali.
              </p>
              <GrafikTren hari={p.tren!.hari} nilai={trenTampil} judul={`Jumlah deteksi titik api per hari, ${p.namaProv ?? "Indonesia"}`} />
              {!!p.tren!.gagal.length && (
                <div className="mt-2 rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Sebagian satelit belum terambil ({p.tren!.gagal.length} dari 3), tren bisa lebih rendah dari sebenarnya.
                </div>
              )}
            </>
          )}

          <h2 className="mt-5 mb-2 text-sm font-bold">Titik api per provinsi</h2>
          {ringkasan.length === 0 ? (
            <p className="text-sm text-redup">{p.hotspot ? "Tidak ada titik api terdeteksi." : "Memuat…"}</p>
          ) : (
            <ul className="space-y-1">
              {provinsiTampil.map((r) => (
                <li key={r.nama}>
                  <button
                    onClick={() => {
                      p.pilihProv(p.namaProv === r.nama ? null : r.nama);
                      tutupDiHp();
                    }}
                    aria-pressed={p.namaProv === r.nama}
                    className={`group relative flex min-h-10 w-full items-center justify-between overflow-hidden rounded-xl px-3 text-left text-sm active:scale-[0.99] ${
                      p.namaProv === r.nama ? "ring-2 ring-[var(--accent)]" : ""
                    }`}
                  >
                    <span className="absolute inset-y-0 left-0 rounded-xl bg-aksen-lembut" style={{ width: `${(r.jumlah / maksProvinsi) * 100}%` }} />
                    <span className="relative font-medium">{r.nama}</span>
                    <span className="relative text-right tabular-nums">
                      <b>{fmtAngka.format(r.jumlah)}</b>
                      <span className="ml-1.5 text-xs text-redup">({fmtAngka.format(r.tinggi)} tinggi)</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {ringkasan.length > 6 && (
            <button onClick={() => setSemuaProvinsi(!semuaProvinsi)} className="mt-1 min-h-10 text-sm font-semibold text-aksen">
              {semuaProvinsi ? "Tampilkan lebih sedikit" : `Lihat semua ${ringkasan.length} provinsi`}
            </button>
          )}

          <h2 className="mt-5 mb-2 text-sm font-bold">
            Kualitas udara terburuk
            {p.udara && <span className="font-normal text-redup"> · diperbarui {relatif(new Date(p.udara.diperbarui), sekarang)}</span>}
          </h2>
          {kotaTerburuk.length === 0 ? (
            <p className="text-sm text-redup">{p.udara ? "Data kualitas udara belum tersedia." : "Memuat…"}</p>
          ) : (
            <ul className="space-y-1">
              {kotaTerburuk.map((k) => {
                const kat = kategoriAqi(k.aqi);
                return (
                  <li key={k.kota}>
                    <button
                      onClick={() => {
                        p.peta?.terbangKe(k.lon, k.lat, 8);
                        tutupDiHp();
                      }}
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm hover:bg-chip"
                    >
                      <span className="grid h-8 w-11 shrink-0 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: kat.warna }}>
                        {k.aqi}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{k.kota}</span>
                        <span className="block truncate text-xs text-redup">
                          {kat.label}
                          {k.pm25 != null && ` · PM2.5 ${k.pm25.toFixed(0)} µg/m³`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {p.aqi && !p.aqi.aktif && (
            <p className="mt-1 text-xs text-redup">Stasiun ukur WAQI belum aktif (WAQI_TOKEN kosong), yang tampil hanya model CAMS.</p>
          )}

          <h2 className="mt-5 mb-2 text-sm font-bold">Legenda</h2>
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-redup">Keyakinan titik api:</span>
              {[["#d7191c", "Tinggi"], ["#ff7b1c", "Sedang"], ["#ffc233", "Rendah"]].map(([w, l]) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: w }} />
                  {l}
                </span>
              ))}
            </div>
            <div>
              <div className="mb-1 text-redup">Indeks kualitas udara (US AQI):</div>
              <div className="grid grid-cols-6 overflow-hidden rounded-lg text-center text-[10px] font-semibold text-white">
                {KATEGORI_AQI.map((k, n) => (
                  <span key={k.label} className="py-1" style={{ background: k.warna }} title={k.label}>
                    {n === 0 ? "0" : KATEGORI_AQI[n - 1].batas + 1}
                    {k.batas === Infinity ? "+" : ""}
                  </span>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-redup">
                <span>Baik</span>
                <span>Berbahaya</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-redup">
              <span className="text-base" aria-hidden>➤</span> Panah di sekitar penanda AQI menunjukkan ke mana angin membawa asap.
            </div>
          </div>

          <div className="mt-5 space-y-1.5 border-t border-garis pt-4 text-[11px] leading-relaxed text-redup">
            <p>
              Titik api dari NASA FIRMS (satelit VIIRS Suomi NPP, NOAA-20, NOAA-21), masuk sekitar 3 jam setelah satelit melintas.
              Titik api adalah indikasi panas, belum tentu kebakaran; konfirmasi di lapangan tetap diperlukan.
            </p>
            <p>
              Citra: NASA GIBS/Worldview. Kualitas udara & angin: Open-Meteo (model CAMS, CC BY 4.0)
              {p.aqi?.aktif && <> dan World Air Quality Index Project beserta EPA asal</>}. Peta dasar: OpenFreeMap. Peta dasar dan batas provinsi: © OpenStreetMap contributors (ODbL).
            </p>
            <p>
              Rujukan resmi:{" "}
              <a className="font-semibold text-aksen" href="https://sipongi.kehutanan.go.id" target="_blank" rel="noopener">
                SiPongi
              </a>{" "}
              ·{" "}
              <a className="font-semibold text-aksen" href="https://www.bmkg.go.id" target="_blank" rel="noopener">
                BMKG
              </a>
              . Situs non-komersial.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
