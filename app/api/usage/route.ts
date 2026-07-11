import { NextRequest, NextResponse } from "next/server";
import { recordOpen, recordSession } from "@/lib/usage";
import { flushDbNow } from "@/lib/sqldb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/usage
 * Body JSON: { event: "open"|"session", deviceId: string, sessionMs?: number }
 * Also accepts text/plain beacon payloads.
 */
export async function POST(request: NextRequest) {
  let body: { event?: string; deviceId?: string; sessionMs?: number } = {};
  try {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      body = (await request.json()) as typeof body;
    } else {
      const text = await request.text();
      body = JSON.parse(text) as typeof body;
    }
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const deviceId = body.deviceId ?? "";
  if (body.event === "open") {
    const ok = recordOpen(deviceId);
    if (ok) await flushDbNow(); // serverless durability
    return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
  }
  if (body.event === "session") {
    const ok = recordSession(deviceId, Number(body.sessionMs ?? 0));
    if (ok) await flushDbNow(); // serverless durability
    return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
  }
  return NextResponse.json({ error: "unknown event" }, { status: 400 });
}
