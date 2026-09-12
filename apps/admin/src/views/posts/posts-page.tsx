import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components";
import { ago } from "@/lib/format";
import { createDraft } from "@/lib/posts/actions";
import { listPosts } from "@/lib/posts/queries";

export async function PostsPage() {
  const posts = await listPosts("flexiq");
  const live = posts.filter((post) => post.status === "published").length;

  return (
    <>
      <PageHeader
        title="Posts"
        sub={posts.length === 0 ? undefined : `${live} live of ${posts.length}`}
      >
        <form action={createDraft}>
          <button type="submit" className="abtn abtn-primary">
            <Plus aria-hidden />
            New post
          </button>
        </form>
      </PageHeader>

      <div className="content content-narrow">
        {posts.length === 0 ? (
          <div className="empty">
            <h3>No posts yet</h3>
            <p>The FlexiQ blog is empty. Write the first one.</p>
            <form action={createDraft}>
              <button type="submit" className="abtn abtn-primary">
                <Plus aria-hidden />
                New post
              </button>
            </form>
          </div>
        ) : (
          <div className="rows">
            <div className="row row-head row-post">
              <span>Status</span>
              <span>Title</span>
              <span>Tags</span>
              <span className="num">Updated</span>
            </div>

            {posts.map((post) => (
              <Link key={post.id} href={`/posts/${post.id}`} className="row row-post">
                <span className={`state state-${post.status}`}>{post.status}</span>
                <span className="row-title">
                  {post.title}
                  <span className="row-sub">/blog/{post.slug}</span>
                </span>
                <span className="tag-row">
                  {post.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </span>
                <span className="num num-dim">{ago(post.updatedAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
