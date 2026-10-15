import type { Address } from "viem";
import { runSweep } from "@/lib/agent";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Vercel Cron (GET) and the "Sincronizar" button (POST { user }).
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  return Response.json(await runSweep(), { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const { user } = (await req.json().catch(() => ({}))) as { user?: Address };
  try {
    return Response.json(await runSweep(user));
  } catch (e) {
    return Response.json({ error: String(e).slice(0, 500) }, { status: 500 });
  }
}
