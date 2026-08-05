import type { Label } from "@/features/news";
import { config } from "../config";
import { fetchJson } from "../http";
import { toLabels } from "../labels";
import type { NewsItem, SourceAdapter } from "../types";
import { containsMention, stableId, stripHtml, truncate } from "../util";

type RedditPost = {
  id: string;
  title: string;
  url: string;
  permalink: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  over_18: boolean;
  stickied: boolean;
  is_self: boolean;
  selftext: string;
  subreddit: string;
};

type RedditListing = { data: { children: { data: RedditPost }[] } };

type SubredditConfig = { name: string; labels: readonly Label[] };

async function fetchSubreddit(sub: SubredditConfig): Promise<(RedditPost & { _hints: Label[] })[]> {
  const url = `https://www.reddit.com/r/${sub.name}/top.json?t=${config.reddit.window}&limit=${config.reddit.perSubLimit}`;
  const data = await fetchJson<RedditListing>(url);
  return data.data.children.map((c) => ({ ...c.data, _hints: [...sub.labels] }));
}

function normalize(post: RedditPost & { _hints: Label[] }): NewsItem {
  const title = post.title.trim();
  const permalinkUrl = `https://www.reddit.com${post.permalink}`;
  const url = post.is_self || !post.url ? permalinkUrl : post.url;
  const excerpt = post.is_self
    ? truncate(stripHtml(post.selftext), 200)
    : truncate(`${post.score} upvotes · ${post.num_comments} comments · r/${post.subreddit}`, 200);
  return {
    id: stableId("reddit", post.id),
    kind: "article",
    source: "reddit",
    title,
    url,
    excerpt: excerpt || null,
    author: post.author,
    publishedAt: new Date(post.created_utc * 1000).toISOString(),
    score: post.score,
    tags: [post.subreddit],
    labels: toLabels([post.subreddit], post._hints),
    mentionsByteveda: containsMention(`${title} ${post.selftext}`),
  };
}

export const redditAdapter: SourceAdapter = {
  name: "reddit",
  source: "reddit",
  async fetch() {
    const settled = await Promise.allSettled(config.reddit.subreddits.map(fetchSubreddit));
    const posts = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    return posts
      .filter((p) => !p.over_18 && !p.stickied)
      .filter((p) => p.score >= config.reddit.minScore)
      .map(normalize);
  },
};
