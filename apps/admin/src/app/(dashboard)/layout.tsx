import { ConfirmProvider, InboxLiveProvider, Rail, SignOut } from "@/components";
import { requireSession } from "@/lib/auth/session";
import { countUnread } from "@/lib/inbox/queries";

/**
 * The real gate. Middleware only checks that a cookie exists; this resolves it
 * against Postgres, so every page below this layout has a verified operator.
 *
 * The two reads are issued together rather than in sequence: the database is in
 * another region, and a round trip spent waiting for the previous one is the
 * largest single cost in rendering any page here. Neither depends on the other
 * — an anonymous request throws out of `requireSession` and the count with it.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [{ user }, unread] = await Promise.all([requireSession(), countUnread()]);

  return (
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
  );
}
