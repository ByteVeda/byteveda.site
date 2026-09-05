import { getPosts } from "@/features/blog/posts";
import { site } from "@/lib/site";

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const dynamic = "force-static";

export function GET(): Response {
  const posts = getPosts();
  const items = posts
    .map((post) =>
      [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${site.url}/blog/${post.slug}</link>`,
        `      <guid isPermaLink="true">${site.url}/blog/${post.slug}</guid>`,
        `      <description>${escapeXml(post.description)}</description>`,
        `      <pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>`,
        "    </item>",
      ].join("\n"),
    )
    .join("\n");

  const feed = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${site.name} — Blog</title>`,
    `    <link>${site.url}/blog</link>`,
    `    <description>${escapeXml(site.description)}</description>`,
    "    <language>en</language>",
    `    <atom:link href="${site.url}/blog/rss.xml" rel="self" type="application/rss+xml" />`,
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");

  return new Response(feed, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
