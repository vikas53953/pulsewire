import { NextRequest, NextResponse } from "next/server";
import { BETA_COOKIE } from "@/lib/beta-auth";

/**
 * Optional beta door: set BETA_TOKEN in the environment.
 * Visit /?key=<token> once → HttpOnly cookie → full access.
 * PW_TEST=1 skips the gate (Playwright).
 * /api/health stays open for ops curls (no secrets beyond operational counters).
 */
export function middleware(request: NextRequest) {
  const token = (process.env.BETA_TOKEN ?? "").trim();
  if (!token || process.env.PW_TEST === "1") {
    return NextResponse.next();
  }

  const { pathname, searchParams } = request.nextUrl;

  // Ops health probe — no auth (do not put secrets in the payload).
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  // Static assets / Next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icon") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const key = searchParams.get("key");
  if (key && key === token) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("key");
    const res = NextResponse.redirect(clean);
    res.cookies.set(BETA_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 90, // 90 days
    });
    return res;
  }

  const cookie = request.cookies.get(BETA_COOKIE)?.value;
  if (cookie === token) {
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${token}`) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error:
          "Beta access required. Open the app once with /?key=YOUR_BETA_TOKEN or send Authorization: Bearer <token>.",
      },
      { status: 401 }
    );
  }

  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>PulseWire beta</title>
<style>body{font-family:ui-monospace,monospace;background:#141414;color:#e8e4dc;display:grid;place-items:center;min-height:100vh;margin:0;padding:2rem;text-align:center}
p{max-width:28rem;line-height:1.5;opacity:.85}code{background:#222;padding:.15em .4em}</style></head>
<body><div><h1>PulseWire</h1><p>Private beta. Open this URL with your invite key:<br/><code>/?key=…</code></p></div></body></html>`,
    {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
