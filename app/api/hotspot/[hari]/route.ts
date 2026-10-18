import { ambilHotspot } from "@/lib/firms";

// Hasil disimpan sebagai halaman ISR: FIRMS dipanggil paling sering
// sekali per 15 menit per rentang hari, berapa pun jumlah pengunjung.
export const revalidate = 900;
// Tetap ISR walau fetch ke sumber memakai no-store.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ hari: "1" }, { hari: "2" }, { hari: "3" }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ hari: string }> }) {
  const { hari } = await params;
  const data = await ambilHotspot(Number(hari));
  return Response.json(data);
}
