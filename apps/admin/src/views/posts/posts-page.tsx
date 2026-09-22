import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components";
import { can } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { createDraft } from "@/lib/posts/actions";
import { listPosts } from "@/lib/posts/queries";
import { ago } from "@/shared/format";

export async function PostsPage() {
  const { access } = await requirePermission("posts.read");
  const posts = await listPosts("flexiq");
  const live = posts.filter((post) => post.status === "published").length;

  // The editor is a writing surface, so a reader gets the list and stops there
  // rather than opening a page every control on which is disabled.
  const write = can(access, "posts.write");

  return (
    <>
      <PageHeader
        title="Posts"
        sub={posts.length === 0 ? undefined : `${live} live of ${posts.length}`}
      >
        {write && (
          <form action={createDraft}>
            <button type="submit" className="abtn abtn-primary">
              <Plus aria-hidden />
              New post
            </button>
          </form>
        )}
      </PageHeader>

      <div className="content content-narrow">
        {posts.length === 0 ? (
          <div className="empty">
            <h3>No posts yet</h3>
            <p>The FlexiQ blog is empty. {write ? "Write the first one." : ""}</p>
            {write && (
              <form action={createDraft}>
                <button type="submit" className="abtn abtn-primary">
                  <Plus aria-hidden />
                  New post
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="rows">
            <div className="row row-head row-post">
              <span>Status</span>
              <span>Title</span>
              <span>Tags</span>
              <span className="num">Updated</span>
            </div>

            {posts.map((post) => {
              const row = (
                <>
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
                </>
              );

              return write ? (
                <Link key={post.id} href={`/posts/${post.id}`} className="row row-post">
                  {row}
                </Link>
              ) : (
                <div key={post.id} className="row row-post">
                  {row}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
