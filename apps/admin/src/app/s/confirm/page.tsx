import type { Metadata } from "next";
import { headers } from "next/headers";
import { Mark } from "@/components/mark";
import { SubscriptionAction } from "@/components/subscription-action";
import { isDirectNavigation, readFetchMetadata } from "@/lib/subscribers/navigation";
import { confirm, lookupByToken } from "@/lib/subscribers/service";

export const metadata: Metadata = { title: "Confirm subscription", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

/**
 * One click from the email. Following the link is the confirmation.
 *
 * Acting on GET means whatever fetches the URL performs the action, so the
 * request has to look like a person: a top-level document navigation, not a
 * prefetch or a scanner. When it does not, the page falls back to a button
 * rather than either confirming silently or refusing a real reader.
 *
 * Following the link a second time lands on the settled state, not an error.
 */
export default async function ConfirmPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const state = await lookupByToken(token ?? "");

  const clicked = isDirectNavigation(readFetchMetadata(await headers()));
  const settled =
    state.found && state.status !== "active" && clicked ? await confirm(token ?? "") : null;

  const subscribed = state.found && (state.status === "active" || settled?.ok === true);

  return (
    <main className="sheet">
      <div className="sheet-card">
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
        ) : subscribed ? (
          <>
            <h1>Subscribed</h1>
            <p>
              <span className="cell-mono">{state.email}</span> is on the list. You will hear from us
              when there is something worth reading.
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

        <p className="sheet-foot">You can unsubscribe from any email we send.</p>
      </div>
    </main>
  );
}
