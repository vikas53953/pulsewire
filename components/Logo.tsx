"use client";

/**
 * SIGNAL BLACK brand mark (design/logo.svg, spec §2): squircle field in ink,
 * heartbeat stroke in the page color — theme-aware via tokens.
 */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="PulseWire"
    >
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="10"
        fill="var(--pw-ink)"
      />
      <path
        d="M6 20h8l3-8 6 16 3-8h8"
        fill="none"
        stroke="var(--pw-bg)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
