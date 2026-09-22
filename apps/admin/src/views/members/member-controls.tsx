"use client";

import {
  ADMIN_ROLE_LABELS,
  ADMIN_ROLES,
  type AdminRole,
  type AdminStatus,
  MAIL_WORKSPACE_LABELS,
  MAIL_WORKSPACES,
  type MailWorkspace,
} from "@byteveda/db/constants";
import { Ban, Trash2, UndoDot, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { useConfirm } from "@/components";
import {
  inviteMember,
  removeMember,
  setMemberRole,
  setMemberStatus,
  setMemberWorkspaces,
} from "@/lib/members/actions";

type Message = { text: string; ok: boolean } | null;

function Note({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p className="note" data-tone={message.ok ? "ok" : "error"} role="status">
      {message.text}
    </p>
  );
}

/**
 * What one member's row can do.
 *
 * Every control writes immediately — there is no save button, because there is
 * no form: a role is one value and a mailbox is one checkbox, and a page of
 * pending changes is a page somebody walks away from half applied.
 *
 * Nothing here is the enforcement. Each action re-asks the server whether this
 * operator may manage members, and refuses if not; this is what stops them
 * being offered the question.
 */
export function MemberControls({
  id,
  login,
  role,
  status,
  workspaces,
  locked,
  lockedReason,
}: {
  id: string;
  login: string;
  role: AdminRole;
  status: AdminStatus;
  workspaces: MailWorkspace[];
  locked: boolean;
  lockedReason: string;
}) {
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const [currentRole, setCurrentRole] = useState(role);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [mail, setMail] = useState(workspaces);

  if (locked) {
    return (
      <span className="member-locked row-actions" title={lockedReason}>
        {lockedReason}
      </span>
    );
  }

  function run(work: () => Promise<{ ok: boolean; message: string }>, revert: () => void) {
    startTransition(async () => {
      const result = await work();
      setMessage({ text: result.message, ok: result.ok });
      if (!result.ok) revert();
    });
  }

  function changeRole(next: AdminRole) {
    const previous = currentRole;
    setCurrentRole(next);
    run(
      () => setMemberRole(id, next),
      () => setCurrentRole(previous),
    );
  }

  function toggleWorkspace(workspace: MailWorkspace) {
    const previous = mail;
    const next = mail.includes(workspace)
      ? mail.filter((candidate) => candidate !== workspace)
      : [...mail, workspace];

    setMail(next);
    run(
      () => setMemberWorkspaces(id, next),
      () => setMail(previous),
    );
  }

  async function toggleStatus() {
    const next: AdminStatus = currentStatus === "active" ? "suspended" : "active";

    if (next === "suspended") {
      const go = await confirm({
        title: `Suspend ${login}?`,
        body: "They are signed out immediately and cannot sign back in until this is undone. Their account and its history stay.",
        confirmLabel: "Suspend",
        destructive: true,
      });
      if (!go) return;
    }

    const previous = currentStatus;
    setCurrentStatus(next);
    run(
      () => setMemberStatus(id, next),
      () => setCurrentStatus(previous),
    );
  }

  async function remove() {
    const go = await confirm({
      title: `Remove ${login}?`,
      body: "Their access, their sessions and the record that they were here all go. Suspending is the reversible one.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!go) return;

    run(
      () => removeMember(id),
      () => undefined,
    );
  }

  return (
    <span className="member-actions row-actions">
      <select
        className="input input-sm"
        aria-label={`Role for ${login}`}
        value={currentRole}
        disabled={pending}
        onChange={(event) => changeRole(event.target.value as AdminRole)}
      >
        {ADMIN_ROLES.map((option) => (
          <option key={option} value={option}>
            {ADMIN_ROLE_LABELS[option]}
          </option>
        ))}
      </select>

      <span className="member-scopes">
        {MAIL_WORKSPACES.map((workspace) => (
          <label key={workspace} className="tick">
            <input
              type="checkbox"
              checked={mail.includes(workspace)}
              disabled={pending}
              onChange={() => toggleWorkspace(workspace)}
            />
            {MAIL_WORKSPACE_LABELS[workspace]}
          </label>
        ))}
      </span>

      <button
        type="button"
        className="abtn abtn-quiet abtn-sm"
        onClick={toggleStatus}
        disabled={pending}
        title={currentStatus === "active" ? `Suspend ${login}` : `Restore ${login}`}
      >
        {currentStatus === "active" ? <Ban aria-hidden /> : <UndoDot aria-hidden />}
        {currentStatus === "active" ? "Suspend" : "Restore"}
      </button>

      <button
        type="button"
        className="tape-remove"
        onClick={remove}
        disabled={pending}
        aria-label={`Remove ${login}`}
      >
        <Trash2 width={13} height={13} aria-hidden />
      </button>

      <Note message={message} />
    </span>
  );
}

/**
 * Adding somebody.
 *
 * A GitHub login, because that is what one person calls another. It is resolved
 * to the numeric id before the row is written — a login can be renamed and the
 * freed name registered by a stranger, and a grant that followed the name would
 * follow it to them.
 *
 * No invitation is sent. There is nothing to accept: the row is the access, and
 * they sign in with GitHub whenever they are told to.
 */
export function InviteForm() {
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<AdminRole>("viewer");
  const [workspaces, setWorkspaces] = useState<MailWorkspace[]>([...MAIL_WORKSPACES]);
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await inviteMember({ handle, role, workspaces });
      setMessage({ text: result.message, ok: result.ok });
      if (result.ok) setHandle("");
    });
  }

  return (
    <div className="panel stack-top">
      <div className="panel-head">
        <h2>Give somebody access</h2>
      </div>

      <div className="panel-body">
        <div className="form-row form-row-member">
          <div className="field">
            <label htmlFor="invite-handle">GitHub login</label>
            <input
              id="invite-handle"
              className="input input-mono"
              value={handle}
              placeholder="octocat"
              onChange={(event) => setHandle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && handle.trim()) submit();
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="invite-role">Role</label>
            <select
              id="invite-role"
              className="input"
              value={role}
              onChange={(event) => setRole(event.target.value as AdminRole)}
            >
              {ADMIN_ROLES.map((option) => (
                <option key={option} value={option}>
                  {ADMIN_ROLE_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="abtn abtn-primary"
            onClick={submit}
            disabled={pending || !handle.trim()}
          >
            <UserPlus aria-hidden />
            {pending ? "Adding…" : "Add"}
          </button>
        </div>

        <div className="form-row">
          <span className="member-scopes">
            <span className="field-label">Mail</span>
            {MAIL_WORKSPACES.map((workspace) => (
              <label key={workspace} className="tick">
                <input
                  type="checkbox"
                  checked={workspaces.includes(workspace)}
                  onChange={() =>
                    setWorkspaces((current) =>
                      current.includes(workspace)
                        ? current.filter((candidate) => candidate !== workspace)
                        : [...current, workspace],
                    )
                  }
                />
                {MAIL_WORKSPACE_LABELS[workspace]}
              </label>
            ))}
          </span>
        </div>

        <p className="form-row-hint">
          Nothing is emailed — tell them to sign in at this console with GitHub. A numeric user id
          works here too, which is what to use if the lookup is rate limited.
        </p>

        <Note message={message} />
      </div>
    </div>
  );
}
