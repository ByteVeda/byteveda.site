import { getPost, getStaticSlugs } from "@/features/blog/posts";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og";
import { site } from "@/lib/site";

export const alt = `${site.name} blog`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export async function generateStaticParams() {
  return (await getStaticSlugs()).map((slug) => ({ slug }));
}

export default async function BlogOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  return ogImage({
    eyebrow: "FlexiQ blog",
    title: post?.title ?? "FlexiQ",
    subtitle: post?.description,
  });
}
