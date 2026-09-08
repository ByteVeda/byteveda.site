import { Rail } from "@/components/rail";
import { SignOut } from "@/components/sign-out";
import { requireSession } from "@/lib/auth/session";
import { countUnread } from "@/lib/inbox/queries";

/**
 * The real gate. Middleware only checks that a cookie exists; this resolves it
 * against Postgres, so every page below this layout has a verified operator.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();
  const unread = await countUnread();

  return (
    <div className="shell">
      <Rail
        user={{ login: user.login, name: user.name, avatarUrl: user.avatarUrl }}
        counts={{ "/inbox": unread }}
      >
        <SignOut />
      </Rail>
      <div className="main">{children}</div>
    </div>
  );
}
