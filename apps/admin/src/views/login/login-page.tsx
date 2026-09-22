import { OctocatIcon } from "@byteveda/ui";
import { redirect } from "next/navigation";
import { Mark } from "@/components";
import { getSession } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/urls";

/**
 * What went wrong, said plainly. Each one names the thing to do next rather
 * than apologising, and `config` is deliberately specific because the only
 * person who can hit it is the one who can fix it.
 */
const FAILURES: Record<string, string> = {
  denied: "That GitHub account has not been given access. Ask a super admin to add it.",
  suspended: "Access for that account has been suspended.",
  state:
    "That sign-in link is no longer valid. If you are tunnelling, start from the ADMIN_URL origin — the callback cannot read a cookie set on a different host.",
  exchange: "GitHub could not complete the sign-in. Try again.",
  config: "Sign-in is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
};

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

export async function LoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams;
  const destination = safeNext(next);

  if (await getSession()) redirect(destination);

  const message = error ? (FAILURES[error] ?? FAILURES.exchange) : null;
  const startUrl = `/api/auth/github?next=${encodeURIComponent(destination)}`;

  return (
    <main className="sheet">
      <div className="sheet-card">
        <span className="mark">
          <Mark />
        </span>

        <h1>ByteVeda admin</h1>
        <p>Posts, download numbers, and mail for byteveda.org. Sign in to continue.</p>

        {message && (
          <div className="notice notice-danger block-gap">
            <span>{message}</span>
          </div>
        )}

        <a className="abtn abtn-primary" href={startUrl}>
          <OctocatIcon aria-hidden />
          Sign in with GitHub
        </a>

        <p className="sheet-foot">Access is by invitation, against a GitHub account.</p>
      </div>
    </main>
  );
}
