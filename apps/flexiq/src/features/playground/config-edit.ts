import type { EngineConfig, TaskConfig } from "@byteveda/flexiq-sim";

/**
 * Config edits are immutable: every control produces a new `EngineConfig`, and
 * a new config restarts the run. That is what keeps a share link honest — the
 * URL describes a scenario from its first tick, not a run someone nudged.
 */

export function patchConfig(config: EngineConfig, patch: Partial<EngineConfig>): EngineConfig {
  return { ...config, ...patch };
}

export function patchTask(
  config: EngineConfig,
  taskName: string,
  patch: Partial<TaskConfig>,
): EngineConfig {
  return {
    ...config,
    tasks: config.tasks.map((task) => (task.name === taskName ? { ...task, ...patch } : task)),
  };
}

export function setRateLimit(
  config: EngineConfig,
  taskName: string,
  count: number | null,
): EngineConfig {
  return patchTask(config, taskName, {
    rateLimit:
      count === null
        ? undefined
        : {
            count,
            perMs: 1000,
            onExcess: config.tasks.find((t) => t.name === taskName)?.rateLimit?.onExcess ?? "defer",
          },
  });
}
