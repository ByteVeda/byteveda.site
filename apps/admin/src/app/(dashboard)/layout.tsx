import { AccessProvider, ConfirmProvider, InboxLiveProvider, Rail, SignOut } from "@/components";
import { readableWorkspaces, requireSession } from "@/features/auth";
import { countUnread } from "@/lib/inbox/queries";

/**
 * The real gate. Middleware only checks that a cookie exists; this resolves it
 * against Postgres, so every page below this layout has a verified operator.
 *
 * It also resolves what that operator may do, once, and puts it where both
 * halves of the console can read it: the rail and the buttons through
 * `AccessProvider`, every page and action through `requireSession` again on the
 * server. One computation, two consumers, no second set of rules.
 *
 * The unread count has to wait for the session now — it is scoped to the
 * workspaces this operator may read, and a badge counting mail they cannot open
 * is worse than no badge.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, access } = await requireSession();
  const unread = await countUnread({ allowed: readableWorkspaces(access) });

  return (
    <AccessProvider access={access}>
      <ConfirmProvider>
        <InboxLiveProvider unread={unread}>
          <div className="shell">
            <Rail user={{ login: user.login, name: user.name, avatarUrl: user.avatarUrl }}>
              <SignOut />
            </Rail>
            <main className="main">{children}</main>
          </div>
        </InboxLiveProvider>
      </ConfirmProvider>
    </AccessProvider>
  );
}
