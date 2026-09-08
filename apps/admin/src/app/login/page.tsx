import { OctocatIcon } from "@byteveda/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Mark } from "@/components/mark";
import { getSession } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/urls";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

/**
 * What went wrong, said plainly. Each one names the thing to do next rather
 * than apologising, and `config` is deliberately specific because the only
 * person who can hit it is the one who can fix it.
 */
const FAILURES: Record<string, string> = {
  denied: "That GitHub account is not on the allowlist.",
  state:
    "That sign-in link is no longer valid. If you are tunnelling, start from the ADMIN_URL origin — the callback cannot read a cookie set on a different host.",
  exchange: "GitHub could not complete the sign-in. Try again.",
  config:
    "Sign-in is not configured. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and ADMIN_GITHUB_IDS.",
};

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams;
  const destination = safeNext(next);

  if (await getSession()) redirect(destination);

  const message = error ? (FAILURES[error] ?? FAILURES.exchange) : null;
  const startUrl = `/api/auth/github?next=${encodeURIComponent(destination)}`;

  return (
    <main className="login">
      <div className="login-card">
        <span className="mark">
          <Mark />
        </span>

        <h1>ByteVeda admin</h1>
        <p>Posts, download numbers, and mail for byteveda.org. Sign in to continue.</p>

        {message && (
          <div className="notice notice-danger" role="alert" style={{ marginBottom: 18 }}>
            <span>{message}</span>
          </div>
        )}

        <a className="abtn abtn-primary" href={startUrl}>
          <OctocatIcon aria-hidden />
          Sign in with GitHub
        </a>

        <p className="login-foot">Access is limited to allowlisted GitHub accounts.</p>
      </div>
    </main>
  );
}
