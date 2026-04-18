import { config } from "../config";
import { fetchJson } from "../http";
import { toLabels } from "../labels";
import type { NewsItem, SourceAdapter } from "../types";
import { containsMention, stableId, stripHtml, truncate } from "../util";

type MastodonCard = {
  url: string;
  title: string | null;
  description: string | null;
  author_name: string | null;
};

type MastodonStatus = {
  id: string;
  uri: string;
  url: string | null;
  content: string;
  created_at: string;
  favourites_count: number;
  reblogs_count: number;
  replies_count: number;
  account: {
    acct: string;
    display_name: string | null;
    username: string;
  };
  tags: { name: string }[];
  card: MastodonCard | null;
  sensitive: boolean;
  reblog: MastodonStatus | null;
};

async function fetchTag(tag: string): Promise<MastodonStatus[]> {
  const url = `https://${config.mastodon.instance}/api/v1/timelines/tag/${encodeURIComponent(
    tag,
  )}?limit=${config.mastodon.perTagLimit}`;
  return fetchJson<MastodonStatus[]>(url);
}

function interactions(status: MastodonStatus): number {
  return status.favourites_count + status.reblogs_count + status.replies_count;
}

function normalize(status: MastodonStatus): NewsItem | null {
  if (status.sensitive || status.reblog) return null;
  const card = status.card;
  const plainContent = stripHtml(status.content);
  const title = card?.title?.trim() || truncate(plainContent, 120);
  if (!title) return null;
  const url = card?.url || status.url || status.uri;
  const author = status.account.display_name?.trim() || status.account.acct;
  const excerpt = card?.description?.trim() || truncate(plainContent, 200);
  return {
    id: stableId("mastodon", status.id),
    kind: "article",
    source: "mastodon",
    title,
    url,
    excerpt: excerpt || null,
    author,
    publishedAt: status.created_at,
    score: interactions(status),
    tags: status.tags.map((t) => t.name),
    labels: toLabels(status.tags.map((t) => t.name)),
    mentionsByteveda: containsMention(`${title} ${plainContent}`),
  };
}

export const mastodonAdapter: SourceAdapter = {
  name: "mastodon",
  source: "mastodon",
  async fetch() {
    const settled = await Promise.allSettled(config.mastodon.tags.map(fetchTag));
    const statuses = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    return statuses
      .filter((s) => interactions(s) >= config.mastodon.minInteractions)
      .map(normalize)
      .filter((item): item is NewsItem => item !== null);
  },
};
