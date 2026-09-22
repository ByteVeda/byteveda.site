// Deep, not through `@/components`: that barrel re-exports the console's client
// components, and this file is on the subscribers front door — every server
// module that imports `@/features/subscribers` would pull the whole UI graph
// with it.
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { maxFileBytes } from "@/features/attachments";
import { can, requirePermission } from "@/features/auth";
import { BroadcastComposer, listBroadcasts } from "@/features/broadcasts";
import { getSettings } from "@/features/settings";
import { ago } from "@/shared/format";
import { countByStatus, listSubscribers } from "../queries";
import { AddSubscriberForm, SubscriberRowActions } from "./subscriber-controls";

/** Confirmed is the only status that gets mail; the rest are shown as state. */
const STATE_CLASS: Record<string, string> = {
  active: "state-published",
  pending: "state-draft",
  unsubscribed: "state-archived",
  bounced: "state-archived",
};

export async function SubscribersPage() {
  const { access } = await requirePermission("subscribers.read");

  const [subscribers, counts, broadcasts, settings] = await Promise.all([
    listSubscribers(),
    countByStatus(),
    listBroadcasts(),
    getSettings(),
  ]);

  const write = can(access, "subscribers.write");
  const broadcast = can(access, "broadcasts.send");

  return (
    <>
      {/* A confirmation happens in the subscriber's browser, so the status here
          would otherwise sit stale until someone reloaded. */}
      <LiveRefresh endpoint="/api/subscribers/stream" />

      <PageHeader
        title="Subscribers"
        sub={
          subscribers.length === 0
            ? undefined
            : `${counts.active} confirmed, ${counts.pending} pending`
        }
      />

      <div className="content content-form">
        {!settings["newsletter.enabled"] && (
          <div className="notice notice-warn block-gap">
            <span>
              Signups are turned off, so the public endpoint refuses new addresses and broadcasts
              cannot send. Turn the newsletter on in Settings.
            </span>
          </div>
        )}

        {subscribers.length === 0 ? (
          <div className="empty">
            <h3>No subscribers yet</h3>
            <p>
              The public sites post to <code>/api/public/subscribe</code>. You can also invite an
              address directly.
            </p>
          </div>
        ) : (
          <div className="rows block-gap">
            <div className="row row-head row-subscriber">
              <span>Status</span>
              <span>Address</span>
              <span>Source</span>
              <span className="num">Added</span>
              <span />
            </div>

            {subscribers.map((subscriber) => (
              <div key={subscriber.id} className="row row-subscriber">
                <span className={`state ${STATE_CLASS[subscriber.status]}`}>
                  {subscriber.status}
                </span>
                <span className="cell-mono row-title">{subscriber.email}</span>
                <span className="tape-eco">{subscriber.source}</span>
                <span className="num num-dim">{ago(subscriber.createdAt)}</span>
                {write ? <SubscriberRowActions subscriber={subscriber} /> : <span />}
              </div>
            ))}
          </div>
        )}

        {write && <AddSubscriberForm />}

        {broadcast && (
          <div className="stack-top">
            <BroadcastComposer
              broadcasts={broadcasts}
              activeCount={counts.active}
              maxFileBytes={maxFileBytes()}
            />
          </div>
        )}
      </div>
    </>
  );
}
