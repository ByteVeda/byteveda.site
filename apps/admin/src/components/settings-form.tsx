"use client";

import { useState, useTransition } from "react";
// From ./registry, not the folder index: the index reaches the database, and
// importing it here would pull `pg` into the browser bundle.
import { SETTINGS, type SettingKey, type SettingsSnapshot } from "@/lib/settings/registry";
import { updateSetting } from "@/lib/settings-actions";

type Props = { initial: SettingsSnapshot; emailReady: boolean };

const BOOLEAN_KEYS = (Object.keys(SETTINGS) as SettingKey[]).filter(
  (key) => SETTINGS[key].type === "boolean",
);
const STRING_KEYS = (Object.keys(SETTINGS) as SettingKey[]).filter(
  (key) => SETTINGS[key].type === "string",
);

export function SettingsForm({ initial, emailReady }: Props) {
  const [values, setValues] = useState<SettingsSnapshot>(initial);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [, startTransition] = useTransition();

  function save(key: SettingKey, value: string | boolean) {
    // Optimistic: a toggle that waits for a round trip feels broken.
    setValues((current) => ({ ...current, [key]: value }));

    startTransition(async () => {
      const result = await updateSetting(key, value);
      setMessage({ text: result.message, ok: result.ok });
      if (!result.ok) setValues((current) => ({ ...current, [key]: initial[key] }));
    });
  }

  return (
    <>
      {!emailReady && (
        <div className="notice notice-warn" style={{ marginBottom: 20 }}>
          <span>
            RESEND_API_KEY is not set, so nothing can send yet. These settings still save, and take
            effect once the key is in place.
          </span>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h2>Email</h2>
        </div>
        <div className="panel-body">
          {BOOLEAN_KEYS.map((key) => (
            <label key={key} className="switch">
              <input
                type="checkbox"
                checked={values[key] as boolean}
                onChange={(event) => save(key, event.target.checked)}
              />
              <span className="who">
                <b>{SETTINGS[key].label}</b>
                <span>{SETTINGS[key].description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Sender</h2>
        </div>
        <div className="panel-body">
          {STRING_KEYS.map((key) => (
            <div key={key} className="field">
              <label htmlFor={key}>{SETTINGS[key].label}</label>
              <input
                id={key}
                className="input"
                defaultValue={values[key] as string}
                onBlur={(event) => {
                  if (event.target.value !== values[key]) save(key, event.target.value);
                }}
              />
              <span className="hint">{SETTINGS[key].description}</span>
            </div>
          ))}
        </div>
      </div>

      {message && (
        <p className="save-state" data-tone={message.ok ? "ok" : "error"} style={{ marginTop: 14 }}>
          {message.text}
        </p>
      )}
    </>
  );
}
