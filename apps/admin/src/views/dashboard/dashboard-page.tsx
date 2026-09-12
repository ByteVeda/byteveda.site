import { FileText, Inbox, TrendingUp } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components";
import { requireSession } from "@/lib/auth/session";
import { count, delta } from "@/lib/format";
import { countUnread } from "@/lib/inbox/queries";
import { countPostsByStatus, listPosts } from "@/lib/posts/queries";
import { getStatsOverview, WINDOW_DAYS } from "@/lib/stats/queries";
import { countByStatus } from "@/lib/subscribers/queries";

function greeting(at = new Date()): string {
  const hour = at.getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export async function OverviewPage() {
  const { user } = await requireSession();

  const [posts, postCounts, stats, unread, subscribers] = await Promise.all([
    listPosts("flexiq"),
    countPostsByStatus("flexiq"),
    getStatsOverview(),
    countUnread(),
    countByStatus(),
  ]);

  const name = user.name?.split(" ")[0] ?? user.login;
  const trend = delta(stats.last30, stats.previous30);
  const drafts = postCounts.draft ?? 0;
  const recent = posts.slice(0, 5);

  return (
    <>
      <PageHeader title="Overview" />

      <div className="content content-narrow">
        <p className="greeting">
          {greeting()}, {name}.
        </p>

        <div className="cards">
          <Link href="/stats" className="card">
            <TrendingUp aria-hidden />
            <b>{count(stats.last30)}</b>
            <span>
              downloads in {WINDOW_DAYS} days <i className={trend.tone}>{trend.label}</i>
            </span>
          </Link>

          <Link href="/posts" className="card">
            <FileText aria-hidden />
            <b>{postCounts.published ?? 0}</b>
            <span>
              posts live
              {drafts > 0 ? `, ${drafts} draft${drafts === 1 ? "" : "s"}` : ""}
            </span>
          </Link>

          <Link href="/inbox" className="card">
            <Inbox aria-hidden />
            <b>{unread}</b>
            <span>unread{subscribers.active > 0 ? `, ${subscribers.active} subscribers` : ""}</span>
          </Link>
        </div>

        {recent.length > 0 && (
          <>
            <h2 className="section-title">Recently edited</h2>
            <div className="rows">
              {recent.map((post) => (
                <Link key={post.id} href={`/posts/${post.id}`} className="row row-post">
                  <span className={`state state-${post.status}`}>{post.status}</span>
                  <span className="row-title">
                    {post.title}
                    <span className="row-sub">/blog/{post.slug}</span>
                  </span>
                  <span />
                  <span />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
