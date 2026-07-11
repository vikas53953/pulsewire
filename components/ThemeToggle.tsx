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
      data-testid="theme-toggle"
      className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[var(--line)] bg-[var(--card)] text-lg transition-[border-color] duration-[120ms] hover:border-[var(--faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
    >
      ◐
    </button>
  );
}
