import { getPost, getPosts } from "@/features/blog/posts";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og";
import { site } from "@/lib/site";

export const alt = `${site.name} blog`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return getPosts().map((post) => ({ slug: post.slug }));
}

export default async function BlogOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);

  return ogImage({
    eyebrow: "FlexiQ blog",
    title: post?.title ?? "FlexiQ",
    subtitle: post?.description,
  });
}
