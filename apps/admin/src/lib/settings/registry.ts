/**
 * What the settings are, with no imports at all.
 *
 * Kept apart from the store so the settings form — a client component — can
 * render the labels and defaults without importing the database module, which
 * would pull `pg` into the browser bundle.
 */
export const SETTINGS = {
  "newsletter.enabled": {
    type: "boolean",
    default: false,
    label: "Accept newsletter signups",
    description: "When off, the signup endpoint refuses new addresses and broadcasts cannot send.",
  },
  "announce.enabled": {
    type: "boolean",
    default: false,
    label: "Email the list when a post is published",
    description: "Creates a broadcast for the post and sends it to every confirmed subscriber.",
  },
  "email.fromName": {
    type: "string",
    default: "ByteVeda",
    label: "From name",
    description: "Shown as the sender on everything this console sends.",
  },
  "email.fromAddress": {
    type: "string",
    default: "hello@byteveda.org",
    label: "From address",
    description: "Must be on a domain verified in Resend.",
  },
  "email.replyTo": {
    type: "string",
    default: "",
    label: "Reply-to address",
    description: "Where replies land. Leave empty to use the from address.",
  },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = (typeof SETTINGS)[K]["default"];
export type SettingsSnapshot = { [K in SettingKey]: SettingValue<K> };

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

export function defaults(): SettingsSnapshot {
  return Object.fromEntries(
    SETTING_KEYS.map((key) => [key, SETTINGS[key].default]),
  ) as SettingsSnapshot;
}
