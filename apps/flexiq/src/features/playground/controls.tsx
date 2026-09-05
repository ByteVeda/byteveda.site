"use client";

import type { EngineConfig } from "@byteveda/flexiq-sim";
import { patchConfig, patchTask, setRateLimit } from "./config-edit";
import type { Preset } from "./presets";
import { PRESETS } from "./presets";
import type { PlaygroundEngine } from "./use-engine";

interface Props {
  preset: Preset;
  config: EngineConfig;
  engine: PlaygroundEngine;
  onPreset: (preset: Preset) => void;
  onConfig: (config: EngineConfig) => void;
  onShare: () => void;
  shared: boolean;
}

const SPEEDS = [0.5, 1, 2, 4];

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="pg-field">
      <span className="pg-field-head">
        {label}
        <b>
          {value}
          {suffix}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Controls({ preset, config, engine, onPreset, onConfig, onShare, shared }: Props) {
  const primary = config.tasks[0];
  const aliveWorker = engine.snapshot?.workers.find((w) => w.alive);

  return (
    <div className="pg-controls">
      <div className="pg-block">
        <h3>Scenario</h3>
        <div className="pg-presets">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="pg-preset"
              aria-pressed={item.id === preset.id}
              onClick={() => onPreset(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="pg-blurb">{preset.blurb}</p>
      </div>

      <div className="pg-block">
        <h3>Configuration</h3>
        <Slider
          label="Workers"
          value={config.workers}
          min={1}
          max={12}
          onChange={(workers) => onConfig(patchConfig(config, { workers }))}
        />
        <Slider
          label="Max retries"
          value={primary.maxRetries}
          min={0}
          max={6}
          onChange={(maxRetries) => onConfig(patchTask(config, primary.name, { maxRetries }))}
        />
        <Slider
          label="Backoff base"
          value={primary.backoff.baseMs / 1000}
          min={0.25}
          max={8}
          step={0.25}
          suffix="s"
          onChange={(seconds) =>
            onConfig(
              patchTask(config, primary.name, {
                backoff: { ...primary.backoff, baseMs: seconds * 1000 },
              }),
            )
          }
        />
        <Slider
          label="Failure rate"
          value={Math.round(primary.failureRate * 100)}
          min={0}
          max={100}
          step={5}
          suffix="%"
          onChange={(percent) =>
            onConfig(patchTask(config, primary.name, { failureRate: percent / 100 }))
          }
        />
        <Slider
          label="Rate limit"
          value={primary.rateLimit?.count ?? 0}
          min={0}
          max={40}
          suffix={primary.rateLimit ? "/s" : " — off"}
          onChange={(count) => onConfig(setRateLimit(config, primary.name, count || null))}
        />
        {primary.rateLimit && (
          <label className="pg-check">
            <input
              type="checkbox"
              checked={primary.rateLimit.onExcess === "drop"}
              onChange={(e) =>
                onConfig(
                  patchTask(config, primary.name, {
                    rateLimit: {
                      ...primary.rateLimit,
                      count: primary.rateLimit?.count ?? 1,
                      perMs: primary.rateLimit?.perMs ?? 1000,
                      onExcess: e.target.checked ? "drop" : "defer",
                    },
                  }),
                )
              }
            />
            Shed excess instead of deferring (<code>on_excess=&quot;drop&quot;</code>)
          </label>
        )}
      </div>

      <div className="pg-block">
        <h3>Transport</h3>
        <div className="pg-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => engine.setRunning(!engine.running)}
          >
            {engine.running ? "Pause" : "Play"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => engine.step()}>
            Step
          </button>
          <button type="button" className="btn btn-ghost" onClick={engine.reset}>
            Reset
          </button>
        </div>
        <div className="pg-speeds">
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              className="tab"
              aria-pressed={engine.speed === value}
              onClick={() => engine.setSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>

      <div className="pg-block">
        <h3>Provoke it</h3>
        <div className="pg-row pg-row-wrap">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => engine.burst(preset.burst.task, preset.burst.count)}
          >
            Burst {preset.burst.count} jobs
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!aliveWorker}
            onClick={() => aliveWorker && engine.killWorker(aliveWorker.id)}
          >
            Kill a worker
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => engine.setFailureRate(primary.name, 0.9)}
          >
            Make the API fail
          </button>
        </div>
        <button type="button" className="btn btn-ghost pg-share" onClick={onShare}>
          {shared ? "Link copied" : "Copy share link"}
        </button>
      </div>
    </div>
  );
}
