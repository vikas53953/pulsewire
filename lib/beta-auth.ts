import { NextRequest } from "next/server";

export const BETA_COOKIE = "pw_beta";

/** Shared beta secret from env. Empty = gate off (local/dev). */
export function getBetaToken(): string {
  return (process.env.BETA_TOKEN ?? "").trim();
}

export function isBetaGateEnabled(): boolean {
  if (process.env.PW_TEST === "1") return false;
  return Boolean(getBetaToken());
}

/**
 * True when the request may spend resources (cache bypass, X deep-refresh).
 * PW_TEST always allowed. When BETA_TOKEN is set, cookie or Bearer/key must match.
 */
export function canSpend(request: NextRequest): boolean {
  if (process.env.PW_TEST === "1") return true;
  const token = getBetaToken();
  if (!token) return true; // gate off — local only; public deploys must set BETA_TOKEN
  const cookie = request.cookies.get(BETA_COOKIE)?.value;
  if (cookie === token) return true;
  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${token}`) return true;
  const key =
    request.nextUrl.searchParams.get("key") ||
    request.headers.get("x-beta-token");
  return key === token;
}

export function spendForbiddenResponse(): Response {
  return Response.json(
    {
      error:
        "Spend path requires beta access. Open /?key=YOUR_BETA_TOKEN once, or send Authorization: Bearer <token>.",
    },
    { status: 401 }
  );
}
