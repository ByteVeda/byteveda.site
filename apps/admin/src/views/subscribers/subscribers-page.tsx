import { LiveRefresh, PageHeader } from "@/components";
import { listBroadcasts } from "@/lib/broadcasts/actions";
import { ago } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { countByStatus, listSubscribers } from "@/lib/subscribers/queries";
import { AddSubscriberForm, BroadcastComposer, SubscriberRowActions } from "./subscriber-controls";

/** Confirmed is the only status that gets mail; the rest are shown as state. */
const STATE_CLASS: Record<string, string> = {
  active: "state-published",
  pending: "state-draft",
  unsubscribed: "state-archived",
  bounced: "state-archived",
};

export async function SubscribersPage() {
  const [subscribers, counts, broadcasts, settings] = await Promise.all([
    listSubscribers(),
    countByStatus(),
    listBroadcasts(),
    getSettings(),
  ]);

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
                <SubscriberRowActions subscriber={subscriber} />
              </div>
            ))}
          </div>
        )}

        <AddSubscriberForm />

        <div className="stack-top">
          <BroadcastComposer broadcasts={broadcasts} activeCount={counts.active} />
        </div>
      </div>
    </>
  );
}
