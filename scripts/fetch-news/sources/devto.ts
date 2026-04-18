import { config } from "../config";
import { fetchJson } from "../http";
import { toLabels } from "../labels";
import type { NewsItem, SourceAdapter } from "../types";
import { containsMention, stableId, stripHtml, truncate } from "../util";

type DevtoArticle = {
  id: number;
  title: string;
  url: string;
  description: string | null;
  tag_list: string[];
  public_reactions_count: number;
  published_at: string;
  user: { name: string | null; username: string };
};

async function fetchTag(tag: string): Promise<DevtoArticle[]> {
  const url = `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=7&per_page=${config.devto.perTagLimit}`;
  return fetchJson<DevtoArticle[]>(url);
}

function normalize(article: DevtoArticle): NewsItem {
  const title = article.title.trim();
  const excerpt = truncate(stripHtml(article.description ?? ""), 200);
  const author = article.user.name?.trim() || article.user.username;
  return {
    id: stableId("devto", String(article.id)),
    kind: "article",
    source: "devto",
    title,
    url: article.url,
    excerpt: excerpt || null,
    author,
    publishedAt: article.published_at,
    score: article.public_reactions_count,
    tags: article.tag_list,
    labels: toLabels(article.tag_list),
    mentionsByteveda: containsMention(`${title} ${excerpt} ${article.tag_list.join(" ")}`),
  };
}

export const devtoAdapter: SourceAdapter = {
  name: "devto",
  source: "devto",
  async fetch() {
    const settled = await Promise.allSettled(config.devto.tags.map(fetchTag));
    const raw = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    return raw.filter((a) => a.public_reactions_count >= config.devto.minReactions).map(normalize);
  },
};
