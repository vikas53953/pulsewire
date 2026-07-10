import { NextRequest, NextResponse } from "next/server";
import { getVibe } from "@/lib/vibe";
import {
  clearTestOverrides,
  parseTestOverrides,
  setTestOverrides,
} from "@/lib/test-mode";
import { isTimeWindow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const windowParam = searchParams.get("window") ?? "4h";
  const overrides = parseTestOverrides(searchParams);

  if (!isTimeWindow(windowParam)) {
    return NextResponse.json({ error: "Invalid window" }, { status: 400 });
  }

  try {
    setTestOverrides(overrides);
    const payload = await getVibe(windowParam);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } finally {
    clearTestOverrides();
  }
}
