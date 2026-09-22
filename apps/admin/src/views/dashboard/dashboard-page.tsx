import { FileText, Inbox, ShieldAlert, TrendingUp } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components";
import { can, readableWorkspaces } from "@/lib/auth/roles";
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

/**
 * What a refused page bounced here to say.
 *
 * `requirePermission` redirects rather than rendering an empty version of the
 * page it was asked for, and the operator is owed a sentence about why —
 * otherwise a bookmark from before a role changed simply teleports them.
 */
const DENIED: Record<string, string> = {
  "posts.read": "Posts",
  "stats.read": "Downloads",
  "mail.read": "the Inbox",
  "subscribers.read": "Subscribers",
  "settings.read": "Settings",
  "members.read": "Members",
};

type Props = { searchParams: Promise<{ denied?: string }> };

/**
 * The overview is the one page every member can open, so it is built from
 * whatever they are allowed to see rather than gated as a whole. A support
 * account gets the unread count and nothing else, which is exactly their job.
 */
export async function OverviewPage({ searchParams }: Props) {
  const [{ user, access }, { denied }] = await Promise.all([requireSession(), searchParams]);

  const seesPosts = can(access, "posts.read");
  const seesStats = can(access, "stats.read");
  const seesMail = can(access, "mail.read");
  const seesSubscribers = can(access, "subscribers.read");

  const [posts, postCounts, stats, unread, subscribers] = await Promise.all([
    seesPosts ? listPosts("flexiq") : Promise.resolve([]),
    seesPosts ? countPostsByStatus("flexiq") : Promise.resolve<Record<string, number>>({}),
    seesStats ? getStatsOverview() : Promise.resolve(null),
    seesMail ? countUnread({ allowed: readableWorkspaces(access) }) : Promise.resolve(0),
    seesSubscribers ? countByStatus() : Promise.resolve({ active: 0, pending: 0 }),
  ]);

  const name = user.name?.split(" ")[0] ?? user.login;
  const trend = stats ? delta(stats.last30, stats.previous30) : null;
  const drafts = postCounts.draft ?? 0;
  const recent = posts.slice(0, 5);

  return (
    <>
      <PageHeader title="Overview" />

      <div className="content content-narrow">
        <p className="greeting">
          {greeting()}, {name}.
        </p>

        {denied && (
          <div className="notice notice-warn block-gap" role="status">
            <ShieldAlert aria-hidden />
            <span>
              Your role does not include {DENIED[denied] ?? "that section"}. A super admin can
              change it under Members.
            </span>
          </div>
        )}

        <div className="cards">
          {stats && trend && (
            <Link href="/stats" className="card">
              <TrendingUp aria-hidden />
              <b>{count(stats.last30)}</b>
              <span>
                downloads in {WINDOW_DAYS} days <i className={trend.tone}>{trend.label}</i>
              </span>
            </Link>
          )}

          {seesPosts && (
            <Link href="/posts" className="card">
              <FileText aria-hidden />
              <b>{postCounts.published ?? 0}</b>
              <span>
                posts live
                {drafts > 0 ? `, ${drafts} draft${drafts === 1 ? "" : "s"}` : ""}
              </span>
            </Link>
          )}

          {seesMail && (
            <Link href="/inbox" className="card">
              <Inbox aria-hidden />
              <b>{unread}</b>
              <span>
                unread
                {seesSubscribers && subscribers.active > 0
                  ? `, ${subscribers.active} subscribers`
                  : ""}
              </span>
            </Link>
          )}
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
