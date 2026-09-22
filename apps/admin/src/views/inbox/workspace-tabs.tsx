import { MAIL_WORKSPACE_LABELS, type MailWorkspace } from "@byteveda/db/constants";
import Link from "next/link";
import type { ThreadFilter, WorkspaceCounts } from "@/lib/inbox/queries";
import { inboxHref } from "@/lib/inbox/url";
import { count } from "@/shared/format";

type Props = {
  allowed: MailWorkspace[];
  selected: MailWorkspace | undefined;
  counts: WorkspaceCounts;
  filter: ThreadFilter;
  query: string;
};

/**
 * Which business's mail is on screen.
 *
 * The console answers for two of them through one Resend account, and before
 * this the academy's order mail and a reader's question about FlexiQ were the
 * same undifferentiated list. Separating them is what makes "answer the
 * academy's mail" a job somebody can be given — and `mail_workspaces` on their
 * row is what makes it a job they can be given *only*.
 *
 * Above the search rather than beside the filters, and rendered on the server:
 * this is the bigger of the two axes — which mailbox, then which of its mail —
 * and every tab is a URL the server can answer on its own.
 *
 * Only rendered when there is more than one to choose between. A single-tab tab
 * bar is furniture.
 */
export function WorkspaceTabs({ allowed, selected, counts, filter, query }: Props) {
  return (
    <nav className="workspace-tabs" aria-label="Mailbox">
      <Link
        href={inboxHref({ filter, query })}
        aria-current={selected === undefined}
        scroll={false}
      >
        All
      </Link>

      {allowed.map((workspace) => {
        const unread = counts[workspace]?.unread ?? 0;

        return (
          <Link
            key={workspace}
            href={inboxHref({ filter, query, workspace })}
            aria-current={selected === workspace}
            scroll={false}
          >
            {MAIL_WORKSPACE_LABELS[workspace]}
            {unread > 0 && <b>{count(unread)}</b>}
          </Link>
        );
      })}
    </nav>
  );
}
