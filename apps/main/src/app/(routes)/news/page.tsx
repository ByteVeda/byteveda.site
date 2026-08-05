import type { Metadata } from "next";
import { Trending } from "@/components/sections";
import { getNewsItems, NewsFeed, NewsHero } from "@/features/news";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "News",
  description:
    "Release notes, engineering write-ups, and community signal from ByteVeda — fast, performance-first libraries shipped in the open.",
  alternates: { canonical: `${site.url}/news` },
};

export default function NewsPage() {
  const all = getNewsItems();
  const lead = all.find((item) => item.kind === "release") ?? all[0];
  const items = lead ? all.filter((item) => item.id !== lead.id) : all;

  return (
    <>
      {lead && <NewsHero lead={lead} />}
      <NewsFeed items={items} />
      <Trending />
    </>
  );
}
