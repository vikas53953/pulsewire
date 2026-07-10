import { NextRequest, NextResponse } from "next/server";
import { getBrief, resetBriefsForTests } from "@/lib/brief";
import { isTestMode, parseTestOverrides, setTestOverrides, clearTestOverrides } from "@/lib/test-mode";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    clusterId?: string;
    title?: string;
    sources?: { name: string; url: string }[];
    action?: string;
    socialFirst?: string;
  };

  if (body.action === "reset" && isTestMode()) {
    resetBriefsForTests();
    return NextResponse.json({ reset: true });
  }

  const clusterId = (body.clusterId || "").trim();
  const title = (body.title || "").trim();
  const sources = Array.isArray(body.sources) ? body.sources : [];

  if (!clusterId || !title) {
    return NextResponse.json(
      { error: "clusterId and title required" },
      { status: 400 }
    );
  }

  const { searchParams } = request.nextUrl;
  const overrides = parseTestOverrides(searchParams);
  try {
    setTestOverrides(overrides);
    const forceRaw = Boolean(overrides.llmFail);
    const brief = await getBrief({
      clusterId,
      title,
      sources,
      forceRaw,
      socialFirst: body.socialFirst,
    });
    return NextResponse.json(brief, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } finally {
    clearTestOverrides();
  }
}
