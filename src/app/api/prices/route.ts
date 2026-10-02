import { NextResponse } from "next/server";
import { getPrices } from "@/lib/finance";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(await getPrices(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Could not load market data" }, { status: 500 }); }
}
