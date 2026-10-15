import { readRates } from "@/lib/rates";

export const revalidate = 60;

export async function GET() {
  return Response.json(await readRates());
}
