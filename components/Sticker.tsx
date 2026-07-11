"use client";

type StickerProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Quiet badge (Signal design): hairline border, mono caps, no rotation.
 * Callers may still pass bg/text overrides via className.
 */
export function Sticker({ children, className = "" }: StickerProps) {
  return (
    <span
      className={`pw-mono inline-block rounded-[6px] border border-[var(--line)] bg-[var(--card)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] ${className}`}
    >
      {children}
    </span>
  );
}
