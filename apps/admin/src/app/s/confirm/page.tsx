import type { Metadata } from "next";
import { Mark } from "@/components/mark";
import { SubscriptionAction } from "@/components/subscription-action";
import { lookupByToken } from "@/lib/subscribers/service";

export const metadata: Metadata = { title: "Confirm subscription", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

/**
 * Reads the token and offers the button; the button does the confirming.
 *
 * Nothing is changed by loading this page, so a mail client prefetching the
 * link cannot subscribe anyone. Following the link again after confirming
 * lands on the settled state rather than an error.
 */
export default async function ConfirmPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const state = await lookupByToken(token ?? "");

  return (
    <main className="login">
      <div className="login-card">
        <span className="mark">
          <Mark size={20} />
        </span>

        {!state.found ? (
          <>
            <h1>That link is not valid</h1>
            <p>It may have been replaced by a newer one. Sign up again to get a fresh link.</p>
            <a className="abtn abtn-quiet" href="https://byteveda.org">
              Go to byteveda.org
            </a>
          </>
        ) : state.status === "active" ? (
          <>
            <h1>Already subscribed</h1>
            <p>
              <span className="cell-mono">{state.email}</span> is on the list. Nothing more to do.
            </p>
            <a className="abtn abtn-quiet" href="https://byteveda.org">
              Go to byteveda.org
            </a>
          </>
        ) : (
          <>
            <h1>Confirm your subscription</h1>
            <p>
              Confirm <span className="cell-mono">{state.email}</span> to receive occasional writing
              from ByteVeda about the tools we build.
            </p>
            <SubscriptionAction token={token ?? ""} action="confirm" label="Confirm subscription" />
          </>
        )}

        <p className="login-foot">You can unsubscribe from any email we send.</p>
      </div>
    </main>
  );
}
