"use client";

type StickerProps = {
  children: React.ReactNode;
  className?: string;
};

/** Yellow rotated sticker badge — used for 🔥 N SOURCES, RAW, etc. */
export function Sticker({ children, className = "" }: StickerProps) {
  return (
    <span
      className={`inline-block border-2 border-[var(--ink)] bg-[var(--sticker)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--ink)] ${className}`}
      style={{ transform: "rotate(4deg)" }}
    >
      {children}
    </span>
  );
}
