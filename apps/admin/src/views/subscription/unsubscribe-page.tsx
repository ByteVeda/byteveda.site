import { headers } from "next/headers";
import { Mark } from "@/components";
import { isDirectNavigation, readFetchMetadata } from "@/lib/subscribers/navigation";
import { lookupByToken, unsubscribe } from "@/lib/subscribers/service";
import { SubscriptionAction } from "./subscription-action";

type Props = { searchParams: Promise<{ token?: string }> };

/**
 * One click, no confirmation step.
 *
 * Asking someone to confirm that they meant to unsubscribe is the pattern that
 * gets mail reported as spam. Same fetch-metadata guard as the confirm page, so
 * a link scanner cannot unsubscribe somebody by looking at the message.
 */
export async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams;
  const state = await lookupByToken(token ?? "");

  const clicked = isDirectNavigation(readFetchMetadata(await headers()));
  const settled =
    state.found && state.status !== "unsubscribed" && clicked
      ? await unsubscribe(token ?? "")
      : null;

  const gone = state.found && (state.status === "unsubscribed" || settled?.ok === true);

  return (
    <main className="sheet">
      <div className="sheet-card">
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
        ) : gone ? (
          <>
            <h1>Unsubscribed</h1>
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
