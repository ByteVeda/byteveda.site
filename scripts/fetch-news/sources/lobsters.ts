import { config } from "../config";
import { fetchJson } from "../http";
import { toLabels } from "../labels";
import type { NewsItem, SourceAdapter } from "../types";
import { containsMention, stableId, truncate } from "../util";

type LobstersStory = {
  short_id: string;
  title: string;
  url: string;
  comments_url: string;
  score: number;
  created_at: string;
  submitter_user: string | { username: string };
  tags: string[];
  description_plain?: string;
};

async function fetchTag(tag: string): Promise<LobstersStory[]> {
  const url = `https://lobste.rs/t/${tag}.json`;
  const data = await fetchJson<LobstersStory[]>(url);
  return data.slice(0, config.lobsters.perTagLimit);
}

function authorOf(story: LobstersStory): string {
  return typeof story.submitter_user === "string"
    ? story.submitter_user
    : story.submitter_user.username;
}

function normalize(story: LobstersStory): NewsItem {
  const title = story.title.trim();
  const url = story.url || story.comments_url;
  const summary = story.description_plain?.trim();
  const excerpt = summary
    ? truncate(summary, 200)
    : truncate(`${story.score} points · ${story.tags.join(", ")}`, 200);
  return {
    id: stableId("lobsters", story.short_id),
    kind: "article",
    source: "lobsters",
    title,
    url,
    excerpt: excerpt || null,
    author: authorOf(story),
    publishedAt: story.created_at,
    score: story.score,
    tags: story.tags,
    labels: toLabels(story.tags),
    mentionsByteveda: containsMention(`${title} ${summary ?? ""}`),
  };
}

export const lobstersAdapter: SourceAdapter = {
  name: "lobsters",
  source: "lobsters",
  async fetch() {
    const settled = await Promise.allSettled(config.lobsters.tags.map(fetchTag));
    const stories = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    return stories.filter((s) => s.score >= config.lobsters.minScore).map(normalize);
  },
};
