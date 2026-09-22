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
import { Ban, KeyRound, Trash2, UndoDot, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { useConfirm } from "@/components/confirm";
import type { Permission } from "@/features/auth/model";
import { inviteMember, removeMember, setMemberStatus } from "../actions";
import type { RoleOption } from "../model";
import { AccessDialog } from "./access-dialog";

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
 * Two of the three controls that used to live here have moved into a dialog,
 * and the row is better for it: a role, a scope and fifteen permissions do not
 * fit beside a name, and the version that tried made the table overlap itself.
 * What is left are the two acts that are genuinely one click — suspend, and
 * remove — plus the button that opens everything else.
 *
 * Nothing here is the enforcement. Each action re-asks the server whether this
 * operator may manage members, and refuses if not; this is what stops them
 * being offered the question.
 */
export function MemberControls({
  member,
  roles,
  locked,
  lockedReason,
}: {
  member: {
    id: string;
    login: string;
    name: string | null;
    role: AdminRole;
    customRoleId: string | null;
    status: AdminStatus;
    permissions: readonly Permission[];
    workspaces: readonly MailWorkspace[];
  };
  roles: RoleOption[];
  locked: boolean;
  lockedReason: string;
}) {
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const confirm = useConfirm();

  const [currentStatus, setCurrentStatus] = useState(member.status);

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

  async function toggleStatus() {
    const next: AdminStatus = currentStatus === "active" ? "suspended" : "active";

    if (next === "suspended") {
      const go = await confirm({
        title: `Suspend ${member.login}?`,
        body: "They are signed out immediately and cannot sign back in until this is undone. Their account and its history stay.",
        confirmLabel: "Suspend",
        destructive: true,
      });
      if (!go) return;
    }

    const previous = currentStatus;
    setCurrentStatus(next);
    run(
      () => setMemberStatus(member.id, next),
      () => setCurrentStatus(previous),
    );
  }

  async function remove() {
    const go = await confirm({
      title: `Remove ${member.login}?`,
      body: "Their access, their sessions and the record that they were here all go. Suspending is the reversible one.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!go) return;

    run(
      () => removeMember(member.id),
      () => undefined,
    );
  }

  return (
    <span className="member-actions row-actions">
      <button
        type="button"
        className="abtn abtn-sm"
        onClick={() => setEditing(true)}
        disabled={pending}
      >
        <KeyRound aria-hidden />
        Access
      </button>

      <button
        type="button"
        className="abtn abtn-quiet abtn-sm"
        onClick={toggleStatus}
        disabled={pending}
        title={currentStatus === "active" ? `Suspend ${member.login}` : `Restore ${member.login}`}
      >
        {currentStatus === "active" ? <Ban aria-hidden /> : <UndoDot aria-hidden />}
        {currentStatus === "active" ? "Suspend" : "Restore"}
      </button>

      <button
        type="button"
        className="tape-remove"
        onClick={remove}
        disabled={pending}
        aria-label={`Remove ${member.login}`}
      >
        <Trash2 width={13} height={13} aria-hidden />
      </button>

      <Note message={message} />

      {editing && (
        <AccessDialog
          member={member}
          roles={roles}
          onClose={() => setEditing(false)}
          onSaved={(text, ok) => setMessage({ text, ok })}
        />
      )}
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
 * Deliberately the short version of the access dialog: a role and a scope, and
 * nothing about exceptions. Somebody being invited does not yet have a shape
 * that needs one, and the row's Access button is a click away if they turn out
 * to.
 *
 * No invitation is sent. There is nothing to accept: the row is the access, and
 * they sign in with GitHub whenever they are told to.
 */
export function InviteForm({ roles }: { roles: RoleOption[] }) {
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const [workspaces, setWorkspaces] = useState<MailWorkspace[]>([...MAIL_WORKSPACES]);
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  const custom = roles.find((option) => option.id === role) ?? null;

  function submit() {
    startTransition(async () => {
      const result = await inviteMember({
        handle,
        role: custom ? "viewer" : (role as AdminRole),
        customRoleId: custom?.id ?? null,
        workspaces,
      });
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
              onChange={(event) => setRole(event.target.value)}
            >
              <optgroup label="Built in">
                {ADMIN_ROLES.map((option) => (
                  <option key={option} value={option}>
                    {ADMIN_ROLE_LABELS[option]}
                  </option>
                ))}
              </optgroup>
              {roles.length > 0 && (
                <optgroup label="Custom">
                  {roles.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              )}
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
