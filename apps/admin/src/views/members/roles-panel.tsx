"use client";

import {
  ADMIN_PERMISSION_LABELS,
  ADMIN_RESOURCE_LABELS,
  ADMIN_ROLE_LABELS,
  ADMIN_ROLES,
  type AdminResource,
  resourceOf,
} from "@byteveda/db/constants";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useConfirm } from "@/components";
import { type Permission, permissionsFor } from "@/features/auth/model";
import { deleteRole } from "@/lib/members/actions";
import { RoleDialog } from "./role-dialog";
import type { RoleOption } from "./types";

/**
 * Every role the console has, whether the source ships it or a super admin
 * wrote it.
 *
 * Shown together on purpose. The built-in four are the answer most of the time
 * and the starting point for the rest, and a screen that listed only the
 * custom ones would make them look like the whole system — a super admin would
 * write "Editor" again rather than discover it already exists.
 *
 * The built-in rows are locked, and say why. Editing them is a commit to
 * `features/auth/model.ts`, which is a reviewable, revertable, attributable act,
 * and that is the property worth keeping for the roles most people are on.
 */
export function RolesPanel({ roles, manage }: { roles: RoleOption[]; manage: boolean }) {
  const [editing, setEditing] = useState<RoleOption | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function remove(role: RoleOption) {
    const go = await confirm({
      title: `Delete “${role.label}”?`,
      body:
        role.members > 0
          ? `${role.members} ${role.members === 1 ? "person is" : "people are"} on this role. They keep their account and fall back to their built-in role, which may grant them less — or more.`
          : "Nobody is on this role. Nothing else changes.",
      confirmLabel: "Delete role",
      destructive: true,
    });
    if (!go) return;

    startTransition(async () => {
      const result = await deleteRole(role.id);
      setMessage({ text: result.message, ok: result.ok });
    });
  }

  return (
    <div className="panel stack-top">
      <div className="panel-head">
        <h2>Roles</h2>
        <span className="meta">
          {ADMIN_ROLES.length} built in
          {roles.length > 0 && `, ${roles.length} custom`}
        </span>
        {manage && (
          <button type="button" className="abtn abtn-sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            New role
          </button>
        )}
      </div>

      <div className="rows">
        {ADMIN_ROLES.map((role) => (
          <RoleRow
            key={role}
            label={ADMIN_ROLE_LABELS[role]}
            handle={role}
            description="Shipped in the source. Changing it takes a commit."
            permissions={permissionsFor(role)}
            locked
          />
        ))}

        {roles.map((role) => (
          <RoleRow
            key={role.id}
            label={role.label}
            handle={role.key}
            description={role.description ?? `Written here. ${role.members} on it.`}
            permissions={role.permissions}
            actions={
              manage && (
                <>
                  <button
                    type="button"
                    className="abtn abtn-quiet abtn-sm"
                    onClick={() => setEditing(role)}
                    disabled={pending}
                  >
                    <Pencil aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="tape-remove"
                    onClick={() => remove(role)}
                    disabled={pending}
                    aria-label={`Delete ${role.label}`}
                  >
                    <Trash2 width={13} height={13} aria-hidden />
                  </button>
                </>
              )
            }
          />
        ))}
      </div>

      {message && (
        <div className="panel-body">
          <p className="note" data-tone={message.ok ? "ok" : "error"} role="status">
            {message.text}
          </p>
        </div>
      )}

      {creating && (
        <RoleDialog
          existing={null}
          onClose={() => setCreating(false)}
          onSaved={(text, ok) => setMessage({ text, ok })}
        />
      )}
      {editing && (
        <RoleDialog
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={(text, ok) => setMessage({ text, ok })}
        />
      )}
    </div>
  );
}

function RoleRow({
  label,
  handle,
  description,
  permissions,
  locked = false,
  actions,
}: {
  label: string;
  handle: string;
  description: string;
  permissions: readonly Permission[];
  locked?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="row row-role">
      <span>
        <b className="row-title">{label}</b>
        <span className="row-sub">{handle}</span>
      </span>

      <span className="role-grants">
        {permissions.length === 0 ? (
          <span className="num-dim">nothing</span>
        ) : (
          summarise(permissions).map((line) => (
            <span key={line} className="tag">
              {line}
            </span>
          ))
        )}
      </span>

      <span className="side-note role-why">{description}</span>

      <span className="row-actions">
        {locked ? <Lock width={13} height={13} aria-hidden className="role-lock" /> : actions}
      </span>
    </div>
  );
}

/**
 * "Posts read·write, Inbox read" — one chip per resource rather than fifteen.
 *
 * A row that listed every permission would be a wall of identical words, and
 * the question it has to answer at a glance is which parts of the console this
 * role touches at all.
 */
function summarise(permissions: readonly Permission[]): string[] {
  const byResource = new Map<AdminResource, string[]>();

  for (const permission of permissions) {
    const resource = resourceOf(permission);
    const verbs = byResource.get(resource) ?? [];
    verbs.push(ADMIN_PERMISSION_LABELS[permission].verb.toLowerCase());
    byResource.set(resource, verbs);
  }

  return [...byResource].map(
    ([resource, verbs]) => `${ADMIN_RESOURCE_LABELS[resource]} ${verbs.join("·")}`,
  );
}
