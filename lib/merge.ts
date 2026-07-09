import type { HighlightItem, RawFeedItem } from "./types";
import { isLikelyDuplicate, stripPublisherSuffix } from "./similarity";
import { flashHeadline } from "./flash";
import { earliestPublishedAt } from "./rank";

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
      if (isLikelyDuplicate(item.title, other.title, threshold)) {
        group.push(other);
        used.add(other.id);
      }
    }

    clusters.push({
      ids: group.map((g) => g.id),
      items: group,
      representative: group[0],
      merged: false,
    });
  }

  return clusters.map((c) => {
    const sources = new Set(c.items.map((i) => i.source));
    return { ...c, merged: sources.size >= 2 };
  });
}

function clusterToHighlight(cluster: MergedCluster): HighlightItem {
  const sources = [];
  const seen = new Set<string>();
  for (const item of cluster.items) {
    const key = `${item.source}|${item.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      name: item.source,
      url: item.url,
      firstSeen: item.publishedAt,
    });
  }

  const publishedAt = earliestPublishedAt(
    cluster.items.map((i) => i.publishedAt)
  );
  const firstSeen = earliestPublishedAt(
    sources.map((s) => s.firstSeen || publishedAt)
  );

  return {
    text: flashHeadline(stripPublisherSuffix(cluster.representative.title)),
    sources,
    publishedAt,
    hot: cluster.merged,
    firstSeen,
  };
}

/** Keep the full 24h cluster set — window cap happens at request time. */
export function clustersToRawHighlights(
  clusters: MergedCluster[],
  maxItems: number
): HighlightItem[] {
  const hot = clusters.filter((c) => c.merged);
  const rest = clusters.filter((c) => !c.merged);
  return [...hot, ...rest].slice(0, maxItems).map(clusterToHighlight);
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
      sources.push({
        name: item.source,
        url: item.url,
        firstSeen: item.publishedAt,
      });
    }

    const distinctSources = new Set(sources.map((s) => s.name));
    const publishedAt = earliestPublishedAt(items.map((i) => i.publishedAt));
    highlights.push({
      text: flashHeadline(row.text.trim()),
      sources,
      publishedAt,
      hot: row.merged || distinctSources.size >= 2,
      firstSeen: earliestPublishedAt(
        sources.map((s) => s.firstSeen || publishedAt)
      ),
    });
  }

  for (const cluster of clusters) {
    if (cluster.ids.every((id) => usedIds.has(id))) continue;
    if (cluster.ids.some((id) => usedIds.has(id))) continue;
    highlights.push(clusterToHighlight(cluster));
  }

  highlights.sort((a, b) => {
    const aSources = a.hot ? a.sources.length : 0;
    const bSources = b.hot ? b.sources.length : 0;
    if (aSources !== bSources) return bSources - aSources;
    if (a.hot !== b.hot) return a.hot ? -1 : 1;
    return (
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  });

  return highlights.slice(0, maxItems);
}
