"use client";

type ThemeToggleProps = {
  night: boolean;
  onToggle: () => void;
};

export function ThemeToggle({ night, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={night ? "Switch to light zine" : "Switch to night zine"}
      title={night ? "Light" : "Night Zine"}
      className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--ink)] bg-[var(--card)] text-lg shadow-[3px_3px_0_var(--shadow)] transition-[transform,box-shadow] duration-[120ms] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--shadow)]"
    >
      ◐
    </button>
  );
}
