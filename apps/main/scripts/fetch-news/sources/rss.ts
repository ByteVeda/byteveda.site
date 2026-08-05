import { XMLParser } from "fast-xml-parser";
import type { Label } from "@/features/news";
import { config } from "../config";
import { fetchText } from "../http";
import { toLabels } from "../labels";
import type { NewsItem, SourceAdapter } from "../types";
import { containsMention, stableId, stripHtml, truncate } from "../util";

type ParsedLink = string | { "@_href"?: string };

type RssItem = {
  guid?: string | { "#text"?: string };
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  "content:encoded"?: string;
  "dc:creator"?: string;
  author?: string;
};

type AtomEntry = {
  id?: string;
  title?: string;
  link?: ParsedLink | ParsedLink[];
  published?: string;
  updated?: string;
  summary?: string | { "#text"?: string };
  content?: string | { "#text"?: string };
  author?: { name?: string } | { name?: string }[];
};

type ParsedFeed = {
  rss?: { channel?: { item?: RssItem | RssItem[] } };
  feed?: { entry?: AtomEntry | AtomEntry[] };
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function atomText(value: string | { "#text"?: string } | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : (value["#text"] ?? "");
}

function atomLink(link: ParsedLink | ParsedLink[] | undefined): string {
  const links = toArray(link);
  for (const entry of links) {
    if (typeof entry === "string") return entry;
    if (entry["@_href"]) return entry["@_href"];
  }
  return "";
}

function atomAuthor(author: AtomEntry["author"]): string | null {
  const authors = toArray(author);
  for (const a of authors) {
    if (a?.name) return a.name;
  }
  return null;
}

function itemId(feedName: string, raw: string): string {
  return stableId(`rss:${feedName}`, raw);
}

type FeedConfig = { name: string; url: string; labels?: readonly Label[] };

function fromRss(feed: FeedConfig, item: RssItem): NewsItem | null {
  const title = item.title?.trim();
  const link = item.link?.trim();
  if (!title || !link) return null;
  const guid = typeof item.guid === "string" ? item.guid : (item.guid?.["#text"] ?? link);
  const descriptionHtml = item["content:encoded"] ?? item.description ?? "";
  const excerpt = truncate(stripHtml(descriptionHtml), 200);
  const author = (item["dc:creator"] ?? item.author ?? feed.name).trim();
  const publishedAt = item.pubDate
    ? new Date(item.pubDate).toISOString()
    : new Date().toISOString();
  return {
    id: itemId(feed.name, guid),
    kind: "article",
    source: "rss",
    title,
    url: link,
    excerpt: excerpt || null,
    author,
    publishedAt,
    score: 0,
    tags: [feed.name],
    labels: toLabels([feed.name], feed.labels ?? []),
    mentionsByteveda: containsMention(`${title} ${excerpt}`),
  };
}

function fromAtom(feed: FeedConfig, entry: AtomEntry): NewsItem | null {
  const title = entry.title?.trim();
  const link = atomLink(entry.link);
  if (!title || !link) return null;
  const id = entry.id ?? link;
  const raw = atomText(entry.summary) || atomText(entry.content);
  const excerpt = truncate(stripHtml(raw), 200);
  const author = atomAuthor(entry.author) ?? feed.name;
  const when = entry.published ?? entry.updated;
  const publishedAt = when ? new Date(when).toISOString() : new Date().toISOString();
  return {
    id: itemId(feed.name, id),
    kind: "article",
    source: "rss",
    title,
    url: link,
    excerpt: excerpt || null,
    author,
    publishedAt,
    score: 0,
    tags: [feed.name],
    labels: toLabels([feed.name], feed.labels ?? []),
    mentionsByteveda: containsMention(`${title} ${excerpt}`),
  };
}

async function fetchFeed(feed: FeedConfig): Promise<NewsItem[]> {
  const xml = await fetchText(feed.url);
  const parsed = parser.parse(xml) as ParsedFeed;
  const rssItems = toArray(parsed.rss?.channel?.item)
    .map((item) => fromRss(feed, item))
    .filter((item): item is NewsItem => item !== null);
  const atomItems = toArray(parsed.feed?.entry)
    .map((entry) => fromAtom(feed, entry))
    .filter((item): item is NewsItem => item !== null);
  return [...rssItems, ...atomItems].slice(0, config.rss.perFeedLimit);
}

export const rssAdapter: SourceAdapter = {
  name: "rss",
  source: "rss",
  async fetch() {
    const settled = await Promise.allSettled(config.rss.feeds.map(fetchFeed));
    return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  },
};
