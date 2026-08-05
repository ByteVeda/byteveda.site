/// <reference types="next" />
// The reference has to live in this file rather than a stray `.d.ts`: `next: {…}`
// is a global `RequestInit` augmentation, and a consumer's tsc only loads it if
// the module that needs it pulls it in.

import { ORG } from "./org";

type RepoResponse = { stargazers_count?: number };

export async function fetchRepoStars(slug: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${ORG}/${slug}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RepoResponse;
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}
