import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, getPosts } from "@/features/blog/posts";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Engineering write-ups from the FlexiQ team — architecture decisions, reliability semantics, and release notes.",
  alternates: {
    canonical: `${site.url}/blog`,
    types: { "application/rss+xml": `${site.url}/blog/rss.xml` },
  },
};

export default function BlogIndex() {
  const posts = getPosts();

  return (
    <section className="blog wrap section-pad">
      <div className="section-head">
        <p className="kicker">Blog</p>
        <h2>How it works, and why it works that way.</h2>
        <p>
          Design decisions, reliability semantics and release notes — written for people who have to
          operate the thing, not just install it.
        </p>
      </div>

      <ul className="post-list">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`} className="post-card">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <h3>{post.title}</h3>
              <p>{post.description}</p>
              <div className="post-tags">
                {post.tags.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
