import type { Permission } from "@/lib/auth/roles";

/**
 * A custom role as the browser sees it.
 *
 * The row minus its timestamps and its author — the parts a dropdown and a
 * permission matrix actually read. Declared here rather than derived from the
 * table type so that a client component never has a reason to import
 * `@byteveda/db`, which would drag `pg` into the bundle.
 */
export type RoleOption = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  permissions: Permission[];
  /** How many people are on it. What makes deleting one a decision. */
  members: number;
};
