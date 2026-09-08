import { Rail } from "@/components/rail";
import { SignOut } from "@/components/sign-out";
import { requireSession } from "@/lib/auth/session";

/**
 * The real gate. Middleware only checks that a cookie exists; this resolves it
 * against Postgres, so every page below this layout has a verified operator.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();

  return (
    <div className="shell">
      <Rail user={{ login: user.login, name: user.name, avatarUrl: user.avatarUrl }}>
        <SignOut />
      </Rail>
      <div className="main">{children}</div>
    </div>
  );
}
