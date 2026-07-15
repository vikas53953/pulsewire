import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/market";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Yahoo fetch (3 symbols, 6s timeout) needs a little headroom on cold hits.
export const maxDuration = 30;

export async function GET() {
  const snapshot = await getMarketSnapshot();
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
