import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCorpus, getPostById, listRevisions } from "@/lib/posts/queries";
import { PostEditor } from "./editor/post-editor";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPostById(id);
  return { title: post?.title ?? "Post" };
}

export async function EditPostPage({ params }: Props) {
  const { id } = await params;

  const post = await getPostById(id);
  if (!post) notFound();

  const [corpus, revisions] = await Promise.all([
    getCorpus(post.id, post.site),
    listRevisions(post.id),
  ]);

  return (
    // Remounting on every server-side change is what makes "restore a revision"
    // reach the editor — the component holds the draft in local state.
    <PostEditor
      key={post.updatedAt.toISOString()}
      post={post}
      corpus={corpus}
      revisions={revisions}
    />
  );
}
