"use client";

import { Archive, ArchiveRestore, MailOpen, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useConfirm } from "@/components";
import { deleteThread, markThreadUnread, setThreadArchived } from "@/lib/inbox/actions";
import type { ThreadFilter } from "@/lib/inbox/queries";
import { inboxHref } from "@/lib/inbox/url";
import { useShortcuts } from "./shortcuts";

type Props = {
  threadKey: string;
  archived: boolean;
  /** Who the conversation is with. Only used to make the delete prompt specific. */
  correspondent: string;
  filter: ThreadFilter;
  query: string;
};

/**
 * What can be done to a conversation as a whole.
 *
 * Every one of these ends by leaving the conversation, which is not politeness
 * — it is required. `ThreadOpener` marks an open unread thread read, so a
 * "mark unread" that stayed put would be undone by its own re-render.
 * Archiving and deleting have the same shape: the thread is no longer in the
 * list behind it, so continuing to show it is a view of something that is not
 * there.
 */
export function ThreadActions({ threadKey, archived, correspondent, filter, query }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  function leave() {
    router.push(inboxHref({ filter, query }));
    router.refresh();
  }

  function archive() {
    startTransition(async () => {
      await setThreadArchived(threadKey, !archived);
      leave();
    });
  }

  function unread() {
    startTransition(async () => {
      await markThreadUnread(threadKey);
      leave();
    });
  }

  async function remove() {
    const go = await confirm({
      title: "Delete this conversation?",
      body: `Every message from ${correspondent} in this thread is removed. It cannot be recovered.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!go) return;

    startTransition(async () => {
      await deleteThread(threadKey);
      leave();
    });
  }

  useShortcuts({ e: archive, u: unread }, !pending);

  return (
    <div className="thread-actions">
      <button type="button" className="abtn abtn-sm" onClick={archive} disabled={pending}>
        {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        {archived ? "Move to inbox" : "Archive"}
      </button>

      {!archived && (
        <button type="button" className="abtn abtn-sm" onClick={unread} disabled={pending}>
          <MailOpen aria-hidden />
          Mark unread
        </button>
      )}

      <button
        type="button"
        className="abtn abtn-sm abtn-danger"
        onClick={remove}
        disabled={pending}
      >
        <Trash2 aria-hidden />
        Delete
      </button>
    </div>
  );
}
