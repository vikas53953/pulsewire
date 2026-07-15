"use client";

/**
 * SIGNAL BLACK v2 brand mark — "Heartbeat Coin".
 *
 * A coin (the wire's face) carrying an edge-to-edge ECG wave (the pulse) that
 * ends in a live blue dot (now — the tip of the wire, transmitting). Circular
 * so it doubles as the feed avatar. Theme-aware via tokens: the coin is --pw-ink,
 * the wave is the page color, and the only blue is the accent dot (brand/action,
 * never status).
 *
 * `pulse` (key it to data.generatedAt) replays a single dot-scale + ring ping on
 * each refresh — motion that means "the board just refreshed", never status.
 * Respects prefers-reduced-motion (see globals.css).
 */
export function Logo({
  size = 40,
  pulse,
}: {
  size?: number;
  /** Change this value (e.g. generatedAt) to replay the refresh pulse. */
  pulse?: string | number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="PulseWire"
      className="pw-logo"
    >
      <circle cx="24" cy="24" r="21.5" fill="var(--pw-ink)" />
      <path
        d="M8 24 H16 L20.5 13 L27.5 35 L31 24 H35"
        fill="none"
        stroke="var(--pw-bg)"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Refresh ping ring — keyed remount replays the animation. */}
      <circle
        key={`ring-${pulse ?? "static"}`}
        className="pw-logo-ring"
        cx="39.5"
        cy="24"
        r="3"
        fill="none"
        stroke="var(--pw-accent)"
        strokeWidth="2"
      />
      <circle
        key={`dot-${pulse ?? "static"}`}
        className="pw-logo-dot"
        cx="39.5"
        cy="24"
        r="3"
        fill="var(--pw-accent)"
      />
    </svg>
  );
}
