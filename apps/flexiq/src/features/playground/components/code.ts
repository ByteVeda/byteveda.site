import type { EngineConfig, RateLimitConfig, TaskConfig } from "@byteveda/flexiq-sim";
import type { Sdk } from "@/lib/docs";

/**
 * Renders the current playground configuration as the FlexiQ code that would
 * express it. This is the page's conversion moment — the visitor tunes the
 * simulation, then copies something that actually runs — so every option
 * spelled here has to match the real SDK surface, not an approximation of it.
 */

const camel = (name: string) => name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const kebab = (name: string) => name.replace(/_/g, "-");

function rateLimitSpec({ count, perMs }: RateLimitConfig): string {
  const unit = perMs === 1000 ? "s" : perMs === 60_000 ? "m" : "h";
  return `${count}/${unit}`;
}

function javaDuration(ms: number): string {
  if (ms % 3_600_000 === 0) return `Duration.ofHours(${ms / 3_600_000})`;
  if (ms % 60_000 === 0) return `Duration.ofMinutes(${ms / 60_000})`;
  if (ms % 1000 === 0) return `Duration.ofSeconds(${ms / 1000})`;
  return `Duration.ofMillis(${ms})`;
}

function pythonTask(task: TaskConfig): string {
  const args = [`max_retries=${task.maxRetries}`, `retry_backoff=${task.backoff.baseMs / 1000}`];
  if (task.backoff.maxMs !== 300_000) args.push(`max_retry_delay=${task.backoff.maxMs / 1000}`);
  if (task.queue !== "default") args.push(`queue="${task.queue}"`);
  if (task.priority !== 0) args.push(`priority=${task.priority}`);
  if (task.rateLimit) {
    args.push(`rate_limit="${rateLimitSpec(task.rateLimit)}"`);
    if (task.rateLimit.onExcess !== "defer") args.push(`on_excess="${task.rateLimit.onExcess}"`);
  }

  const decorator =
    args.length > 2
      ? `@queue.task(\n    ${args.join(",\n    ")},\n)`
      : `@queue.task(${args.join(", ")})`;

  const periodic = task.cron
    ? `\n\n@queue.periodic(name="${kebab(task.name)}", cron="${task.cron}")\ndef ${task.name}_schedule() -> None:\n    ${task.name}.delay()`
    : "";

  return `${decorator}\ndef ${task.name}() -> None:\n    ...${periodic}`;
}

function nodeTask(task: TaskConfig): string {
  const name = camel(task.name);
  const options = [
    `maxRetries: ${task.maxRetries}`,
    `retryBackoff: { baseMs: ${task.backoff.baseMs}, maxMs: ${task.backoff.maxMs} }`,
  ];
  if (task.queue !== "default") options.push(`queue: "${task.queue}"`);
  if (task.priority !== 0) options.push(`priority: ${task.priority}`);
  if (task.rateLimit) {
    options.push(`rateLimit: "${rateLimitSpec(task.rateLimit)}"`);
    if (task.rateLimit.onExcess !== "defer") options.push(`onExcess: "${task.rateLimit.onExcess}"`);
  }
  if (task.cron) options.push(`cron: "${task.cron}"`);

  return `queue.task("${name}", ${name}, {\n  ${options.join(",\n  ")},\n});`;
}

function javaTask(task: TaskConfig): string {
  const constant = task.name.toUpperCase();
  const lines = [
    `Task<Void> ${constant} = Task.of("${kebab(task.name)}", Void.class)`,
    `        .maxRetries(${task.maxRetries})`,
    `        .retryPolicy(RetryPolicy.exponential(${javaDuration(task.backoff.baseMs)}, ${javaDuration(task.backoff.maxMs)}))`,
  ];
  if (task.queue !== "default") lines.push(`        .queue("${task.queue}")`);
  if (task.priority !== 0) lines.push(`        .priority(${task.priority})`);
  if (task.rateLimit) {
    lines.push(`        .rateLimit("${rateLimitSpec(task.rateLimit)}")`);
    if (task.rateLimit.onExcess !== "defer") {
      lines.push(`        .onExcess(OnExcess.${task.rateLimit.onExcess.toUpperCase()})`);
    }
  }
  if (task.cron) lines.push(`        .cron("${task.cron}")`);
  return `${lines.join("\n")};`;
}

export function renderCode(config: EngineConfig, sdk: Sdk): string {
  const [first] = config.tasks;

  if (sdk === "python") {
    const pool = config.poolKind === "prefork" ? " --pool prefork" : "";
    return [
      "from flexiq import Queue",
      "",
      'queue = Queue(db_path="tasks.db")',
      "",
      config.tasks.map(pythonTask).join("\n\n"),
      "",
      `${first.name}.delay()`,
      "",
      `# $ flexiq worker --app tasks:queue --concurrency ${config.workers}${pool}`,
    ].join("\n");
  }

  if (sdk === "node") {
    return [
      'import { Queue } from "@byteveda/flexiq";',
      "",
      'const queue = new Queue({ dbPath: "flexiq.db" });',
      "",
      config.tasks.map(nodeTask).join("\n\n"),
      "",
      `queue.enqueue("${camel(first.name)}", []);`,
      `queue.runWorker({ concurrency: ${config.workers} });`,
    ].join("\n");
  }

  return [
    "import org.byteveda.flexiq.*;",
    "import org.byteveda.flexiq.task.Task;",
    "import java.time.Duration;",
    "",
    config.tasks.map(javaTask).join("\n\n"),
    "",
    'try (FlexiQ queue = FlexiQ.builder().sqlite("tasks.db").open();',
    `     Worker worker = queue.worker().concurrency(${config.workers}).start()) {`,
    `  queue.enqueue(${first.name.toUpperCase()}, null);`,
    "}",
  ].join("\n");
}

export const CODE_FILENAME: Record<Sdk, string> = {
  python: "tasks.py",
  node: "tasks.ts",
  java: "Tasks.java",
};
