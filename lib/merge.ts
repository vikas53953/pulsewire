import type { HighlightItem, RawFeedItem } from "./types";
import { isLikelyDuplicate, stripPublisherSuffix } from "./similarity";
import { trimTitle } from "./feed-engine";

export interface MergedCluster {
  ids: string[];
  items: RawFeedItem[];
  representative: RawFeedItem;
  merged: boolean;
}

/**
 * Greedy cluster by fuzzy title similarity >= 0.6 across different sources.
 */
export function clusterBySimilarity(
  items: RawFeedItem[],
  threshold = 0.6
): MergedCluster[] {
  const sorted = [...items].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const clusters: MergedCluster[] = [];
  const used = new Set<string>();

  for (const item of sorted) {
    if (used.has(item.id)) continue;
    const group: RawFeedItem[] = [item];
    used.add(item.id);

    for (const other of sorted) {
      if (used.has(other.id)) continue;
      // Prefer cross-source merges; same-source near-dupes still merge
      if (isLikelyDuplicate(item.title, other.title, threshold)) {
        group.push(other);
        used.add(other.id);
      }
    }

    const sources = new Set(group.map((g) => g.source));
    clusters.push({
      ids: group.map((g) => g.id),
      items: group,
      representative: group[0],
      merged: sources.size >= 2 || group.length >= 2,
    });
  }

  // Only mark hot when 2+ distinct sources
  return clusters.map((c) => {
    const sources = new Set(c.items.map((i) => i.source));
    return { ...c, merged: sources.size >= 2 };
  });
}

export function clustersToRawHighlights(
  clusters: MergedCluster[],
  maxItems: number
): HighlightItem[] {
  const hot = clusters.filter((c) => c.merged);
  const rest = clusters.filter((c) => !c.merged);

  const ordered = [...hot, ...rest].slice(0, maxItems);

  return ordered.map((cluster) => {
    const sources = [];
    const seen = new Set<string>();
    for (const item of cluster.items) {
      const key = `${item.source}|${item.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push({ name: item.source, url: item.url });
    }

    const newest = cluster.items.reduce((a, b) =>
      new Date(a.publishedAt) >= new Date(b.publishedAt) ? a : b
    );

    return {
      text: trimTitle(stripPublisherSuffix(cluster.representative.title)),
      sources,
      publishedAt: newest.publishedAt,
      hot: cluster.merged,
    };
  });
}

export function applyLlmHighlights(
  clusters: MergedCluster[],
  llm: { ids: string[]; text: string; merged: boolean }[],
  maxItems: number
): HighlightItem[] {
  const byId = new Map<string, RawFeedItem>();
  for (const c of clusters) {
    for (const item of c.items) byId.set(item.id, item);
  }

  const usedIds = new Set<string>();
  const highlights: HighlightItem[] = [];

  for (const row of llm) {
    const items = row.ids
      .map((id) => byId.get(id))
      .filter((x): x is RawFeedItem => Boolean(x));
    if (items.length === 0) continue;

    for (const id of row.ids) usedIds.add(id);

    const sources = [];
    const seen = new Set<string>();
    for (const item of items) {
      const key = `${item.source}|${item.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push({ name: item.source, url: item.url });
    }

    const newest = items.reduce((a, b) =>
      new Date(a.publishedAt) >= new Date(b.publishedAt) ? a : b
    );

    const distinctSources = new Set(sources.map((s) => s.name));
    highlights.push({
      text: row.text.trim(),
      sources,
      publishedAt: newest.publishedAt,
      hot: row.merged || distinctSources.size >= 2,
    });
  }

  // Append any leftover clusters not covered by LLM
  for (const cluster of clusters) {
    if (cluster.ids.every((id) => usedIds.has(id))) continue;
    if (cluster.ids.some((id) => usedIds.has(id))) continue;
    const [fallback] = clustersToRawHighlights([cluster], 1);
    if (fallback) highlights.push(fallback);
  }

  highlights.sort((a, b) => {
    if (a.hot !== b.hot) return a.hot ? -1 : 1;
    return (
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  });

  return highlights.slice(0, maxItems);
}
