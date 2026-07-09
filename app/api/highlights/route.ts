import { NextRequest, NextResponse } from "next/server";
import { clearCache } from "@/lib/cache";
import { getHighlights } from "@/lib/highlights";
import { isSectionId, isTimeWindow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sectionParam = searchParams.get("section") ?? "all";
  const windowParam = searchParams.get("window") ?? "4h";
  const forceRefresh = searchParams.get("refresh") === "1";

  if (!isSectionId(sectionParam)) {
    return NextResponse.json(
      {
        error: `Invalid section. Use one of: all, india, markets, economy, politics, sports, world, tech`,
      },
      { status: 400 }
    );
  }

  if (!isTimeWindow(windowParam)) {
    return NextResponse.json(
      { error: "Invalid window. Use one of: 1h, 4h, 12h, 24h" },
      { status: 400 }
    );
  }

  try {
    if (forceRefresh) {
      clearCache(sectionParam);
    }

    const payload = await getHighlights({
      section: sectionParam,
      window: windowParam,
      forceRefresh,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[pulsewire] /api/highlights failed:", message);
    return NextResponse.json(
      { error: "Failed to load highlights", detail: message },
      { status: 500 }
    );
  }
}
