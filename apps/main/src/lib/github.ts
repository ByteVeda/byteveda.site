type RepoResponse = { stargazers_count?: number };

export async function fetchRepoStars(slug: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/ByteVeda/${slug}`, {
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
