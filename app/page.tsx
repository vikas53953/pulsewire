import { PulseWireApp } from "@/components/PulseWireApp";
import { getHighlights } from "@/lib/highlights";
import { startBackgroundWarmer } from "@/lib/warmer";
import type { HighlightsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

startBackgroundWarmer();

/**
 * Server-render first paint with real verdict + chips + tiles.
 * Reviewers (and slow JS) must not see an empty shell.
 */
export default async function HomePage() {
  let initialData: HighlightsResponse | null = null;
  try {
    initialData = await getHighlights({
      section: "all",
      window: "4h",
      lens: "window",
    });
  } catch (err) {
    console.warn(
      `[pulsewire] SSR highlights failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return <PulseWireApp initialData={initialData} />;
}
