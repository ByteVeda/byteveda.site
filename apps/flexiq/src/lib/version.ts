import { site } from "./site";

/**
 * Used when the releases API is unreachable — a stale-but-valid version beats a
 * build failure, and beats a snippet that says `latest`.
 */
export const FALLBACK_VERSION = "1.1.0";

const RELEASES_URL = "https://api.github.com/repos/ByteVeda/flexiq/releases/latest";

/**
 * The published FlexiQ version, resolved at build time and revalidated hourly.
 * Install snippets derive from it, so the Gradle coordinate on the page cannot
 * drift behind Maven Central.
 */
export async function getVersion(): Promise<string> {
  try {
    const response = await fetch(RELEASES_URL, {
      headers: { accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return FALLBACK_VERSION;
    const release = (await response.json()) as { tag_name?: string };
    const tag = release.tag_name?.replace(/^v/, "");
    return tag && /^\d+\.\d+\.\d+/.test(tag) ? tag : FALLBACK_VERSION;
  } catch {
    // Offline builds and rate limits both land here; neither should fail a deploy.
    return FALLBACK_VERSION;
  }
}

export const installCommands = (version: string) => ({
  python: "pip install flexiq",
  node: "pnpm add @byteveda/flexiq",
  java: `implementation("org.byteveda:flexiq:${version}")`,
});

export const repoUrl = site.repoUrl;
