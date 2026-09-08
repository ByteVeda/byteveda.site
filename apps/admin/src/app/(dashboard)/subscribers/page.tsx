import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import {
  AddSubscriberForm,
  BroadcastComposer,
  SubscriberRowActions,
} from "@/components/subscribers/subscriber-controls";
import { listBroadcasts } from "@/lib/broadcasts/actions";
import { ago } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { countByStatus, listSubscribers } from "@/lib/subscribers/queries";

export const metadata: Metadata = { title: "Subscribers" };
export const dynamic = "force-dynamic";

/** Confirmed is the only status that gets mail; the rest are shown as state. */
const STATE_CLASS: Record<string, string> = {
  active: "state-published",
  pending: "state-draft",
  unsubscribed: "state-archived",
  bounced: "state-archived",
};

export default async function SubscribersPage() {
  const [subscribers, counts, broadcasts, settings] = await Promise.all([
    listSubscribers(),
    countByStatus(),
    listBroadcasts(),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Subscribers"
        sub={
          subscribers.length === 0
            ? undefined
            : `${counts.active} confirmed, ${counts.pending} pending`
        }
      />

      <div className="content content-narrow">
        {!settings["newsletter.enabled"] && (
          <div className="notice notice-warn" style={{ marginBottom: 20 }}>
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
          <div className="rows" style={{ marginBottom: 24 }}>
            <div
              className="row row-head"
              style={{ gridTemplateColumns: "110px minmax(0,1fr) 90px 70px 64px" }}
            >
              <span>Status</span>
              <span>Address</span>
              <span>Source</span>
              <span className="num">Added</span>
              <span />
            </div>

            {subscribers.map((subscriber) => (
              <div
                key={subscriber.id}
                className="row"
                style={{ gridTemplateColumns: "110px minmax(0,1fr) 90px 70px 64px" }}
              >
                <span className={`state ${STATE_CLASS[subscriber.status]}`}>
                  {subscriber.status}
                </span>
                <span
                  className="row-title"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}
                >
                  {subscriber.email}
                </span>
                <span className="tape-eco">{subscriber.source}</span>
                <span className="num num-dim">{ago(subscriber.createdAt)}</span>
                <SubscriberRowActions subscriber={subscriber} />
              </div>
            ))}
          </div>
        )}

        <AddSubscriberForm />

        <div style={{ marginTop: 28 }}>
          <BroadcastComposer broadcasts={broadcasts} activeCount={counts.active} />
        </div>
      </div>
    </>
  );
}
