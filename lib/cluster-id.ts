import { createHash } from "crypto";

/** Stable cluster key from member raw feed ids (sorted). */
export function clusterIdFromMemberIds(ids: string[]): string {
  const key = [...ids].filter(Boolean).sort().join("|");
  if (!key) return createHash("sha1").update("empty").digest("hex").slice(0, 16);
  return createHash("sha1").update(key).digest("hex").slice(0, 16);
}
