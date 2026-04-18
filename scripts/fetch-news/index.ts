import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFeed } from "./pipeline";
import { devtoAdapter } from "./sources/devto";
import { githubAdapter } from "./sources/github";
import { githubTrendingAdapter } from "./sources/github-trending";
import { hashnodeAdapter } from "./sources/hashnode";
import { hnAdapter } from "./sources/hn";
import { lobstersAdapter } from "./sources/lobsters";
import { mastodonAdapter } from "./sources/mastodon";
import { redditAdapter } from "./sources/reddit";
import { rssAdapter } from "./sources/rss";
import type { NewsItem, SourceAdapter } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../../src/content/news.json");

const adapters: SourceAdapter[] = [
  devtoAdapter,
  hnAdapter,
  redditAdapter,
  lobstersAdapter,
  hashnodeAdapter,
  mastodonAdapter,
  rssAdapter,
  githubAdapter,
  githubTrendingAdapter,
];

async function runAdapter(adapter: SourceAdapter): Promise<NewsItem[]> {
  try {
    const items = await adapter.fetch();
    console.log(`  ✓ ${adapter.name}: ${items.length} items`);
    return items;
  } catch (err) {
    console.warn(`  ✗ ${adapter.name}: ${(err as Error).message}`);
    return [];
  }
}

async function readExisting(): Promise<NewsItem[]> {
  try {
    const raw = await readFile(OUTPUT_PATH, "utf8");
    return JSON.parse(raw) as NewsItem[];
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  console.log("Fetching news from sources…");
  const results = await Promise.all(adapters.map(runAdapter));
  const feed = buildFeed(results.flat());
  console.log(`Writing ${feed.length} items → ${OUTPUT_PATH}`);

  const existing = await readExisting();
  const next = JSON.stringify(feed, null, 2);
  const prev = JSON.stringify(existing, null, 2);
  if (next === prev) {
    console.log("No changes.");
    return;
  }
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${next}\n`, "utf8");
  console.log("Updated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
