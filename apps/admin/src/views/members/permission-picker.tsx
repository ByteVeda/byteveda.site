"use client";

import {
  ADMIN_PERMISSION_LABELS,
  ADMIN_RESOURCE_LABELS,
  ADMIN_RESOURCES,
  type AdminResource,
  resourceOf,
} from "@byteveda/db/constants";
import { PERMISSIONS, type Permission, RESERVED_PERMISSIONS } from "@/lib/auth/roles";

/**
 * Which permissions are ticked, grouped by the thing they are about.
 *
 * Grouped rather than one flat list of fifteen checkboxes, because the question
 * a super admin is actually answering is "what do they do with the inbox" —
 * and the answer is three ticks that belong together. The resource is the
 * heading; the verbs sit under it with a sentence each saying what ticking one
 * hands over.
 *
 * Used twice with the same markup and a different meaning for `base`: editing
 * a role, where there is nothing to inherit from and a tick is simply a grant;
 * and editing one person, where `base` is what their role already gives and
 * every difference is labelled as an exception. Drawing both from one component
 * is what keeps "inherited" meaning the same thing on both screens — and the
 * same thing the server means when it computes the diff.
 */
export function PermissionPicker({
  value,
  base,
  onChange,
  disabled = false,
}: {
  value: readonly Permission[];
  /**
   * What the chosen role grants, when there is one. Undefined while editing a
   * role itself — a role inherits from nothing.
   */
  base?: readonly Permission[];
  onChange: (next: Permission[]) => void;
  disabled?: boolean;
}) {
  const ticked = new Set(value);

  // Reserved grants are not offered at all. Showing a permanently disabled
  // `members.manage` would invite the question of how to enable it, and the
  // answer is a commit to lib/auth/roles.ts, not a checkbox.
  const grantable = PERMISSIONS.filter((permission) => !RESERVED_PERMISSIONS.includes(permission));

  function toggle(permission: Permission) {
    onChange(
      grantable.filter((candidate) =>
        candidate === permission ? !ticked.has(candidate) : ticked.has(candidate),
      ),
    );
  }

  /** The header control: everything in this resource, or none of it. */
  function setResource(resource: AdminResource, on: boolean) {
    const inGroup = new Set(grantable.filter((permission) => resourceOf(permission) === resource));
    onChange(
      grantable.filter((permission) => (inGroup.has(permission) ? on : ticked.has(permission))),
    );
  }

  return (
    <div className="perm-grid">
      {ADMIN_RESOURCES.map((resource) => {
        const group = grantable.filter((permission) => resourceOf(permission) === resource);
        if (group.length === 0) return null;

        const on = group.filter((permission) => ticked.has(permission)).length;

        return (
          // biome-ignore lint/a11y/useSemanticElements: the semantic element is <fieldset>, whose <legend> is laid out by rules of its own that no browser applies consistently inside a flex or grid fieldset — and this heading has to sit in a row with the all/none button. `role="group"` plus a label carries the same semantics with none of that.
          <div
            key={resource}
            className="perm-group"
            data-active={on > 0}
            role="group"
            aria-label={ADMIN_RESOURCE_LABELS[resource]}
          >
            <p className="perm-legend">
              <span>{ADMIN_RESOURCE_LABELS[resource]}</span>
              <button
                type="button"
                className="perm-all"
                disabled={disabled}
                onClick={() => setResource(resource, on < group.length)}
              >
                {on < group.length ? "All" : "None"}
              </button>
            </p>

            {group.map((permission) => {
              const label = ADMIN_PERMISSION_LABELS[permission];
              const checked = ticked.has(permission);
              const inherited = base?.includes(permission);

              return (
                <label key={permission} className="perm" data-on={checked}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(permission)}
                  />
                  <span className="perm-text">
                    <span className="perm-verb">
                      {label.verb}
                      {/* Only the differences are called out. A tick that
                          matches the role needs no explanation; one that does
                          not is the whole reason this screen exists. */}
                      {base && checked && !inherited && <b className="perm-flag">added</b>}
                      {base && !checked && inherited && (
                        <b className="perm-flag perm-flag-off">removed</b>
                      )}
                    </span>
                    <span className="perm-hint">{label.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
