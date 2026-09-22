"use client";

import {
  ADMIN_ROLE_LABELS,
  ADMIN_ROLES,
  type AdminRole,
  MAIL_WORKSPACE_LABELS,
  MAIL_WORKSPACES,
  type MailWorkspace,
} from "@byteveda/db/constants";
import { useMemo, useState, useTransition } from "react";
import { basePermissionsFor, type Permission, permissionsFor } from "@/lib/auth/roles";
import { type AccessDraft, setMemberAccess } from "@/lib/members/actions";
import { Modal } from "./modal";
import { PermissionPicker } from "./permission-picker";
import type { RoleOption } from "./types";

/**
 * Everything one member is allowed to do, on one screen.
 *
 * Three questions that used to be three controls squeezed into a table row,
 * where the third one — which permissions, exactly — had nowhere to go at all.
 * Given room, they read as what they are: a role as the starting point, a
 * scope for the axis a role deliberately says nothing about, and a matrix for
 * the exceptions.
 *
 * The draft lives here and is written once. Nothing is saved until Save, which
 * is the opposite of the old row's behaviour and the right one for a form with
 * this many parts: a half-applied grant is worse than an unapplied one.
 */
export function AccessDialog({
  member,
  roles,
  onClose,
  onSaved,
}: {
  member: {
    id: string;
    login: string;
    name: string | null;
    role: AdminRole;
    customRoleId: string | null;
    permissions: readonly Permission[];
    workspaces: readonly MailWorkspace[];
  };
  roles: readonly RoleOption[];
  onClose: () => void;
  onSaved: (message: string, ok: boolean) => void;
}) {
  // A custom role is picked by its id, a built-in one by its key. They cannot
  // collide — one is a uuid — so a single select value covers both.
  const [choice, setChoice] = useState<string>(member.customRoleId ?? member.role);
  const [permissions, setPermissions] = useState<Permission[]>([...member.permissions]);
  const [workspaces, setWorkspaces] = useState<MailWorkspace[]>([...member.workspaces]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const custom = roles.find((role) => role.id === choice) ?? null;

  /** What the chosen role hands over before this member's exceptions. */
  const base = useMemo(
    () => basePermissionsFor(custom ? member.role : (choice as AdminRole), custom),
    [choice, custom, member.role],
  );

  const added = permissions.filter((permission) => !base.includes(permission));
  const removed = base.filter((permission) => !permissions.includes(permission));

  /**
   * Switching role rebases the exceptions rather than discarding them.
   *
   * Somebody moved from support to editor who had `posts.publish` granted by
   * name should keep it; the rest of their permissions should become the
   * editor's. Replacing the whole set would silently undo a deliberate grant,
   * and keeping it wholesale would make the new role decorative.
   */
  function changeRole(next: string) {
    const nextCustom = roles.find((role) => role.id === next) ?? null;
    const nextBase = basePermissionsFor(nextCustom ? member.role : (next as AdminRole), nextCustom);

    setChoice(next);
    setPermissions([...new Set([...nextBase, ...added])].filter((p) => !removed.includes(p)));
  }

  function save() {
    setError(null);

    const draft: AccessDraft = {
      role: choice,
      custom: Boolean(custom),
      permissions,
      workspaces,
    };

    startTransition(async () => {
      const result = await setMemberAccess(member.id, draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onSaved(result.message, true);
      onClose();
    });
  }

  const exceptions = added.length + removed.length;

  return (
    <Modal
      title="Access"
      sub={`${member.name ?? member.login} · @${member.login}`}
      onClose={onClose}
      footer={
        <>
          <span className="dialog-status">
            {exceptions === 0
              ? "Exactly what the role grants."
              : `${exceptions} exception${exceptions === 1 ? "" : "s"} to the role.`}
          </span>
          <button
            type="button"
            className="abtn abtn-quiet"
            disabled={pending || exceptions === 0}
            onClick={() => setPermissions([...base])}
          >
            Reset to role
          </button>
          <button type="button" className="abtn abtn-quiet" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="abtn abtn-primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save access"}
          </button>
        </>
      }
    >
      <div className="dialog-split">
        <div className="field">
          <label htmlFor="access-role">Role</label>
          <select
            id="access-role"
            className="input"
            value={choice}
            disabled={pending}
            onChange={(event) => changeRole(event.target.value)}
          >
            <optgroup label="Built in">
              {ADMIN_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ADMIN_ROLE_LABELS[role]}
                </option>
              ))}
            </optgroup>
            {roles.length > 0 && (
              <optgroup label="Custom">
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <span className="hint">
            {custom?.description ??
              (custom
                ? "A role a super admin wrote."
                : `${permissionsFor(choice as AdminRole).length} permissions by default.`)}
          </span>
        </div>

        <div className="field">
          {/* Not a permission, and deliberately not part of one. "Admin, but
              only the academy inbox" and "support, both inboxes" are both real
              grants, and folding the two axes together would need a role per
              combination. */}
          <span className="field-label">Inbox scope</span>
          <div className="scope-row">
            {MAIL_WORKSPACES.map((workspace) => (
              <label key={workspace} className="tick tick-box">
                <input
                  type="checkbox"
                  checked={workspaces.includes(workspace)}
                  disabled={pending}
                  onChange={() =>
                    setWorkspaces((current) =>
                      current.includes(workspace)
                        ? current.filter((candidate) => candidate !== workspace)
                        : MAIL_WORKSPACES.filter(
                            (candidate) => candidate === workspace || current.includes(candidate),
                          ),
                    )
                  }
                />
                {MAIL_WORKSPACE_LABELS[workspace]}
              </label>
            ))}
          </div>
          <span className="hint">
            Which mail they may open. Reading it still needs the Inbox permission below.
          </span>
        </div>
      </div>

      <div className="dialog-section">
        <h3>Permissions</h3>
        <p className="side-note">
          Ticked by the role unless you change it here. A change is stored as an exception, so
          moving them to another role later still moves everything you have not touched.
        </p>
      </div>

      <PermissionPicker
        value={permissions}
        base={base}
        onChange={setPermissions}
        disabled={pending}
      />

      {error && (
        <p className="note" data-tone="error" role="status">
          {error}
        </p>
      )}
    </Modal>
  );
}
