import { projects } from "@/lib/projects";
import { config } from "../config";
import { fetchJson, HttpError } from "../http";
import { toLabels } from "../labels";
import type { NewsItem, SourceAdapter } from "../types";
import { stableId, stripHtml, truncate } from "../util";

type GithubRelease = {
  id: number;
  name: string | null;
  tag_name: string;
  html_url: string;
  body: string | null;
  published_at: string | null;
  created_at: string;
  draft: boolean;
  prerelease: boolean;
  author: { login: string } | null;
};

type GithubRepo = { name: string; archived: boolean; fork: boolean };

function authHeaders(): Record<string, string> {
  const token = process.env.GH_NEWS_TOKEN ?? process.env.GITHUB_TOKEN;
  const base: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

async function listRepos(): Promise<string[]> {
  const url = `https://api.github.com/orgs/${config.github.org}/repos?per_page=${config.github.reposLimit}&type=public&sort=updated`;
  const repos = await fetchJson<GithubRepo[]>(url, { headers: authHeaders() });
  return repos.filter((r) => !r.archived && !r.fork).map((r) => r.name);
}

async function listReleases(repo: string): Promise<GithubRelease[]> {
  const url = `https://api.github.com/repos/${config.github.org}/${repo}/releases?per_page=${config.github.releasesPerRepo}`;
  try {
    return await fetchJson<GithubRelease[]>(url, { headers: authHeaders() });
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return [];
    throw err;
  }
}

function repoLanguages(repo: string): string[] {
  const project = projects.find((p) => p.slug.toLowerCase() === repo.toLowerCase());
  return project?.languages.map((lang) => lang.toLowerCase()) ?? [];
}

function normalize(repo: string, release: GithubRelease): NewsItem | null {
  if (release.draft) return null;
  const publishedAt = release.published_at ?? release.created_at;
  const displayName = (release.name ?? "").trim() || release.tag_name;
  const title = displayName.toLowerCase().startsWith(repo.toLowerCase())
    ? displayName
    : `${repo} ${displayName}`;
  const excerpt = truncate(stripHtml(release.body ?? ""), 200);
  const tags = [repo, release.prerelease ? "prerelease" : "release"];
  return {
    id: stableId("github", `${repo}:${release.id}`),
    kind: "release",
    source: "github",
    title,
    url: release.html_url,
    excerpt: excerpt || null,
    author: release.author?.login ?? null,
    publishedAt,
    score: 0,
    tags,
    labels: toLabels(repoLanguages(repo)),
    mentionsByteveda: true,
  };
}

export const githubAdapter: SourceAdapter = {
  name: "github:releases",
  source: "github",
  async fetch() {
    const repos = await listRepos();
    const settled = await Promise.allSettled(
      repos.map(async (repo) => {
        const releases = await listReleases(repo);
        return releases
          .map((release) => normalize(repo, release))
          .filter((item): item is NewsItem => item !== null);
      }),
    );
    return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  },
};
