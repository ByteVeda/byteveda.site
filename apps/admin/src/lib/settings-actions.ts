"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { SETTINGS, type SettingKey, setSetting } from "@/lib/settings";

export type SettingsResult = { ok: boolean; message: string };

/**
 * Writes one setting.
 *
 * The key is checked against the registry rather than trusted: a server action
 * is a public endpoint, and this one writes to a key-value table.
 */
export async function updateSetting(key: string, value: unknown): Promise<SettingsResult> {
  await requireSession();

  const definition = SETTINGS[key as SettingKey];
  if (!definition) return { ok: false, message: "Unknown setting." };

  if (typeof value !== definition.type) {
    return { ok: false, message: `${definition.label} expects a ${definition.type}.` };
  }

  await setSetting(key as SettingKey, value as never);

  revalidatePath("/settings");
  revalidatePath("/subscribers");

  return { ok: true, message: "Saved." };
}
