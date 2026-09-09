import type { MetadataRoute } from "next";
import { getPosts } from "@/features/blog/posts";
import { site } from "@/lib/site";

// Not force-static: a newly published post has to be able to reach the sitemap
// without a rebuild.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = (await getPosts()).map((post) => ({
    url: `${site.url}/blog/${post.slug}`,
    lastModified: new Date(`${post.date}T00:00:00Z`),
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  return [
    { url: site.url, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/playground`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${site.url}/blog`, changeFrequency: "weekly", priority: 0.7 },
    ...posts,
  ];
}
