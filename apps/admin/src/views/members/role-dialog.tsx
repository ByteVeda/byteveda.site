"use client";

import { useState, useTransition } from "react";
import { type Permission, permissionsFor } from "@/lib/auth/roles";
import { createRole, type RoleDraft, updateRole } from "@/lib/members/actions";
import { Modal } from "./modal";
import { PermissionPicker } from "./permission-picker";
import type { RoleOption } from "./types";

/**
 * Writing a role, or editing one.
 *
 * The same form either way: the difference between creating and editing is
 * which action it calls and one extra sentence about who is already on it.
 * Splitting them into two components would mean two permission matrices to
 * keep in step, for one line of copy.
 *
 * Starting from a built-in role rather than from nothing is offered because
 * that is what these are for — "support, plus publishing" is the shape people
 * actually ask for, and typing fifteen ticks to express it invites a mistake
 * in the ones they did not mean to change.
 */
export function RoleDialog({
  // Named `existing` rather than `role`, which is what it is: a JSX attribute
  // called `role` is an ARIA role as far as a linter is concerned, whatever
  // component it is on.
  existing,
  onClose,
  onSaved,
}: {
  /** The role being edited, or null to write a new one. */
  existing: RoleOption | null;
  onClose: () => void;
  onSaved: (message: string, ok: boolean) => void;
}) {
  const [label, setLabel] = useState(existing?.label ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [permissions, setPermissions] = useState<Permission[]>(
    existing ? [...existing.permissions] : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    const draft: RoleDraft = { label, description, permissions };

    startTransition(async () => {
      const result = existing ? await updateRole(existing.id, draft) : await createRole(draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onSaved(result.message, true);
      onClose();
    });
  }

  return (
    <Modal
      title={existing ? "Edit role" : "New role"}
      sub={
        existing
          ? `${existing.key} · ${existing.members} ${existing.members === 1 ? "member" : "members"}`
          : "A role of your own, built from the same permissions the built-in ones use."
      }
      onClose={onClose}
      footer={
        <>
          <span className="dialog-status">
            {permissions.length} permission{permissions.length === 1 ? "" : "s"}
            {existing && existing.members > 0 && ` · affects ${existing.members} now`}
          </span>
          <button type="button" className="abtn abtn-quiet" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="abtn abtn-primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : existing ? "Save role" : "Create role"}
          </button>
        </>
      }
    >
      <div className="dialog-split">
        <div className="field">
          <label htmlFor="role-label">Name</label>
          <input
            id="role-label"
            className="input"
            value={label}
            placeholder="Release manager"
            disabled={pending}
            onChange={(event) => setLabel(event.target.value)}
          />
          <span className="hint">
            {existing
              ? `Renaming is safe — ${existing.key} stays the handle this role is known by.`
              : "What the job is called. It appears in every role dropdown."}
          </span>
        </div>

        <div className="field">
          <label htmlFor="role-description">Description</label>
          <input
            id="role-description"
            className="input"
            value={description}
            placeholder="Ships posts, answers nothing."
            disabled={pending}
            onChange={(event) => setDescription(event.target.value)}
          />
          <span className="hint">Optional. Shown when somebody picks this role.</span>
        </div>
      </div>

      {!existing && (
        <div className="dialog-section">
          <h3>Start from</h3>
          <div className="scope-row">
            {(["admin", "editor", "support", "viewer"] as const).map((builtin) => (
              <button
                key={builtin}
                type="button"
                className="abtn abtn-quiet abtn-sm"
                disabled={pending}
                onClick={() => setPermissions([...permissionsFor(builtin)])}
              >
                {builtin}
              </button>
            ))}
            <button
              type="button"
              className="abtn abtn-quiet abtn-sm"
              disabled={pending}
              onClick={() => setPermissions([])}
            >
              nothing
            </button>
          </div>
        </div>
      )}

      <div className="dialog-section">
        <h3>Permissions</h3>
        <p className="side-note">
          Everyone on this role gets exactly these, unless their own row says otherwise. Managing
          members is not on the list — that stays with the super admins named in the source.
        </p>
      </div>

      <PermissionPicker value={permissions} onChange={setPermissions} disabled={pending} />

      {error && (
        <p className="note" data-tone="error" role="status">
          {error}
        </p>
      )}
    </Modal>
  );
}
