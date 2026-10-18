import { ambilTren } from "@/lib/firms";

// Tren harian cukup diperbarui tiap 3 jam: data 8 hari dari tiga satelit
// berukuran belasan MB, dan satelit baru melintas beberapa kali sehari.
export const revalidate = 10800;
// Tetap ISR walau fetch ke sumber memakai no-store.
export const dynamic = "force-static";

export async function GET() {
  return Response.json(await ambilTren());
}
