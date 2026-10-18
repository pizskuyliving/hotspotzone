"use client";

import { useState } from "react";

type Props = { hari: string[]; nilai: number[]; judul: string };

const fmtAngka = new Intl.NumberFormat("id-ID");
const fmtRingkas = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const fmtHari = new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" });
const fmtTanggal = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

const TINGGI = 96; // px area kolom

// Kolom jumlah deteksi per hari. Satu seri, jadi tanpa legenda; judul yang menamainya.
// Hari terakhir (hari ini) belum lengkap, ditandai pucat + garis putus.
export default function GrafikTren({ hari, nilai, judul }: Props) {
  const [aktif, setAktif] = useState<number | null>(null);
  const maks = Math.max(1, ...nilai);
  const iMaks = nilai.indexOf(Math.max(...nilai));
  const terakhir = nilai.length - 1;
  const tgl = (h: string) => new Date(`${h}T00:00:00Z`);

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{judul}</figcaption>
      <div className="relative" onPointerLeave={() => setAktif(null)}>
        {aktif != null && (
          <div
            role="status"
            className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-teks px-2 py-1 text-[11px] whitespace-nowrap text-bg shadow"
            style={{ left: `${((aktif + 0.5) / nilai.length) * 100}%` }}
          >
            <b className="tabular-nums">{fmtAngka.format(nilai[aktif])}</b> deteksi · {fmtTanggal.format(tgl(hari[aktif]))}
            {aktif === terakhir && " (belum lengkap)"}
          </div>
        )}
        <div className="grid items-end gap-1 border-b border-garis" style={{ gridTemplateColumns: `repeat(${nilai.length}, 1fr)`, height: TINGGI + 18 }} aria-hidden>
          {nilai.map((v, i) => {
            const label = i === iMaks || i === terakhir;
            return (
              <button
                key={hari[i]}
                type="button"
                tabIndex={-1}
                onPointerEnter={() => setAktif(i)}
                onClick={() => setAktif(aktif === i ? null : i)}
                className="flex h-full flex-col items-center justify-end"
              >
                <span className={`mb-0.5 text-[10px] tabular-nums ${label ? "text-redup" : "invisible"}`}>{fmtRingkas.format(v)}</span>
                <span
                  className="w-full max-w-6 rounded-t"
                  style={{
                    height: Math.max(2, (v / maks) * TINGGI),
                    background: "var(--accent)",
                    opacity: i === terakhir ? 0.45 : aktif == null || aktif === i ? 1 : 0.6,
                    outline: i === terakhir ? "1.5px dashed var(--accent)" : undefined,
                    outlineOffset: -1.5,
                  }}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-1 grid text-center text-[10px] text-redup" style={{ gridTemplateColumns: `repeat(${nilai.length}, 1fr)` }} aria-hidden>
          {hari.map((h, i) => (
            <span key={h}>{i === terakhir ? "Hari ini" : fmtHari.format(tgl(h))}</span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{judul}</caption>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Jumlah deteksi</th>
          </tr>
        </thead>
        <tbody>
          {hari.map((h, i) => (
            <tr key={h}>
              <td>
                {fmtTanggal.format(tgl(h))}
                {i === terakhir && " (belum lengkap)"}
              </td>
              <td>{fmtAngka.format(nilai[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
