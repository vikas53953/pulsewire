export function relativeAge(iso: string, now = Date.now()): string {
  const ageMs = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.round(ageMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatSources(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}
