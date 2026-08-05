import { config } from "../config";
import { fetchJson } from "../http";
import { toLabels } from "../labels";
import type { NewsItem, SourceAdapter } from "../types";
import { containsMention, stableId, truncate } from "../util";

type HnHit = {
  objectID: string;
  title: string | null;
  story_title: string | null;
  url: string | null;
  story_url: string | null;
  author: string;
  points: number | null;
  num_comments: number | null;
  created_at: string;
  _tags: string[];
};

type HnResponse = { hits: HnHit[] };

async function search(query: string): Promise<HnHit[]> {
  const params = new URLSearchParams({
    query,
    tags: "story",
    hitsPerPage: String(config.hn.perQueryLimit),
  });
  const url = `https://hn.algolia.com/api/v1/search_by_date?${params}`;
  const data = await fetchJson<HnResponse>(url);
  return data.hits;
}

function normalize(hit: HnHit): NewsItem | null {
  const title = (hit.title ?? hit.story_title ?? "").trim();
  const url = hit.url ?? hit.story_url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`;
  if (!title) return null;
  const points = hit.points ?? 0;
  const tags = hit._tags.filter((t) => !t.startsWith("author_") && !t.startsWith("story_"));
  return {
    id: stableId("hn", hit.objectID),
    kind: "article",
    source: "hn",
    title,
    url,
    excerpt: truncate(`${points} points · ${hit.num_comments ?? 0} comments`, 200),
    author: hit.author,
    publishedAt: hit.created_at,
    score: points,
    tags,
    labels: toLabels(tags),
    mentionsByteveda: containsMention(`${title} ${url}`),
  };
}

export const hnAdapter: SourceAdapter = {
  name: "hn",
  source: "hn",
  async fetch() {
    const settled = await Promise.allSettled(config.hn.queries.map(search));
    const hits = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    return hits
      .map(normalize)
      .filter((item): item is NewsItem => item !== null)
      .filter((item) => item.mentionsByteveda || item.score >= config.hn.minPoints);
  },
};
