import { config } from "../config";
import { fetchJson } from "../http";
import { toLabels } from "../labels";
import type { NewsItem, SourceAdapter } from "../types";
import { stableId, truncate } from "../util";

type GithubRepo = {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  owner: { login: string };
  stargazers_count: number;
  pushed_at: string;
  language: string | null;
  topics: string[];
};

type SearchResponse = { items: GithubRepo[] };

function sinceDate(days: number): string {
  const d = new Date(Date.now() - days * 86400_000);
  return d.toISOString().slice(0, 10);
}

function authHeaders(): Record<string, string> {
  const token = process.env.GH_NEWS_TOKEN ?? process.env.GITHUB_TOKEN;
  const base: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

async function searchLanguage(language: string): Promise<GithubRepo[]> {
  const q = [
    `language:${language}`,
    `stars:>${config.trending.minStars}`,
    `pushed:>${sinceDate(config.trending.withinDays)}`,
  ].join(" ");
  const params = new URLSearchParams({
    q,
    sort: "stars",
    order: "desc",
    per_page: String(config.trending.perLanguageLimit),
  });
  const url = `https://api.github.com/search/repositories?${params}`;
  const data = await fetchJson<SearchResponse>(url, { headers: authHeaders() });
  return data.items;
}

function normalize(repo: GithubRepo): NewsItem {
  const tags = [repo.language, ...repo.topics].filter(
    (tag): tag is string => typeof tag === "string" && tag.length > 0,
  );
  return {
    id: stableId("github-trending", String(repo.id)),
    kind: "trending",
    source: "github",
    title: repo.full_name,
    url: repo.html_url,
    excerpt: repo.description ? truncate(repo.description, 200) : null,
    author: repo.owner.login,
    publishedAt: repo.pushed_at,
    score: repo.stargazers_count,
    tags,
    labels: toLabels(tags),
    mentionsByteveda: false,
  };
}

export const githubTrendingAdapter: SourceAdapter = {
  name: "github:trending",
  source: "github",
  async fetch() {
    const settled = await Promise.allSettled(config.trending.languages.map(searchLanguage));
    const repos = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const seen = new Set<number>();
    const out: NewsItem[] = [];
    for (const repo of repos) {
      if (seen.has(repo.id)) continue;
      seen.add(repo.id);
      out.push(normalize(repo));
    }
    return out;
  },
};
