import { getDb, settings } from "@byteveda/db";
import { inArray } from "drizzle-orm";
import { defaults, SETTING_KEYS, SETTINGS, type SettingKey, type SettingsSnapshot } from "./model";

/**
 * Every setting, with defaults filled in.
 *
 * A stored value of the wrong shape falls back to its default rather than
 * propagating — a hand-edited row should not be able to break a page.
 */
export async function getSettings(): Promise<SettingsSnapshot> {
  const snapshot = defaults();

  const rows = await getDb()
    .select()
    .from(settings)
    .where(inArray(settings.key, SETTING_KEYS as string[]));

  for (const row of rows) {
    const key = row.key as SettingKey;
    const expected = SETTINGS[key]?.type;
    if (expected && typeof row.value === expected) {
      (snapshot as Record<string, unknown>)[key] = row.value;
    }
  }

  return snapshot;
}
