import type { Metadata } from "next";
import { Mark } from "@/components/mark";
import { SubscriptionAction } from "@/components/subscription-action";
import { lookupByToken } from "@/lib/subscribers/service";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

/**
 * One button, no second confirmation step.
 *
 * Making someone confirm that they meant to unsubscribe is the pattern that
 * gets mail reported as spam. The click is the confirmation — the page exists
 * only so a link scanner cannot unsubscribe somebody by looking at the message.
 */
export default async function UnsubscribePage({ searchParams }: Props) {
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
            <p>It may have been replaced by a newer one.</p>
            <a className="abtn abtn-quiet" href="https://byteveda.org">
              Go to byteveda.org
            </a>
          </>
        ) : state.status === "unsubscribed" ? (
          <>
            <h1>Already unsubscribed</h1>
            <p>
              <span className="cell-mono">{state.email}</span> will not hear from us again.
            </p>
            <a className="abtn abtn-quiet" href="https://byteveda.org">
              Go to byteveda.org
            </a>
          </>
        ) : (
          <>
            <h1>Unsubscribe</h1>
            <p>
              Stop sending email to <span className="cell-mono">{state.email}</span>.
            </p>
            <SubscriptionAction token={token ?? ""} action="unsubscribe" label="Unsubscribe" />
          </>
        )}
      </div>
    </main>
  );
}
