import type { EngineConfig } from "@byteveda/flexiq-sim";
import { DEFAULT_PRESET, findPreset, type Preset } from "./presets";

/**
 * Playground state travels in the URL so a tuned scenario is something you can
 * paste into a thread. An unmodified preset encodes as its id — the common case
 * stays a short, readable link; only edited configs pay for the blob.
 */

const PRESET_KEY = "p";
const CONFIG_KEY = "s";

function encode(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode<T>(encoded: string): T | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

export function toSearchParams(preset: Preset, config: EngineConfig): string {
  const params = new URLSearchParams({ [PRESET_KEY]: preset.id });
  if (JSON.stringify(config) !== JSON.stringify(preset.config)) {
    params.set(CONFIG_KEY, encode(config));
  }
  return params.toString();
}

export interface SharedState {
  preset: Preset;
  config: EngineConfig;
}

export function fromSearchParams(search: string): SharedState {
  const params = new URLSearchParams(search);
  const preset = findPreset(params.get(PRESET_KEY) ?? "") ?? DEFAULT_PRESET;
  const encoded = params.get(CONFIG_KEY);
  const config = encoded ? decode<EngineConfig>(encoded) : null;

  // A malformed or hand-edited blob falls back to the preset rather than
  // throwing: a bad link should still show something worth looking at.
  return { preset, config: isEngineConfig(config) ? config : preset.config };
}

function isEngineConfig(value: unknown): value is EngineConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EngineConfig>;
  return (
    typeof candidate.seed === "number" &&
    typeof candidate.workers === "number" &&
    candidate.workers > 0 &&
    candidate.workers <= 24 &&
    Array.isArray(candidate.tasks) &&
    candidate.tasks.length > 0
  );
}
