import { PHASE_PRODUCTION_BUILD } from "next/constants";

// Rute API melempar galat saat sumber data gagal agar ISR tetap menyajikan
// data terakhir yang berhasil. Saat build belum ada data lama, jadi di fase
// ini rute mengembalikan hasil kosong supaya build tidak gagal.
export const sedangBuild = () => process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;
