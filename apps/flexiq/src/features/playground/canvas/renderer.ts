import type { EngineSnapshot, Job } from "@byteveda/flexiq-sim";

/**
 * A pure-ish canvas view of an engine snapshot: the only state it keeps is
 * where each job's dot currently is on screen, so particles can ease toward
 * their target instead of teleporting. Nothing here can change the simulation.
 */

/**
 * Where a job is on the board. Jobs move between lanes, and every move between
 * lanes goes through the scheduler, because in FlexiQ it genuinely does — the
 * scheduler is what claims a job for a worker, what reschedules a failed one,
 * and what dead-letters it once the budget is spent. A dot cutting straight
 * from the queue to a worker would draw a system that does not exist.
 */
type Lane = "queue" | "orbit" | "worker" | "dlq";

interface Particle {
  x: number;
  y: number;
  born: number;
  lane: Lane;
  /** A waypoint to touch before heading for the target. Cleared on arrival. */
  via: { x: number; y: number } | null;
}

function laneOf(job: Job): Lane {
  if (job.state === "running") return "worker";
  if (job.state === "dead" || job.state === "dropped") return "dlq";
  if (job.state === "retrying") return "orbit";
  return "queue";
}

/**
 * Whether a lane change has to be drawn through the scheduler. Leaving the
 * orbit for the dead-letter queue does not: an orbiting dot is already circling
 * the scheduler, so it is on its way out from there anyway.
 */
function routesThroughScheduler(from: Lane, to: Lane): boolean {
  if (from === to) return false;
  return !(from === "orbit" && to === "dlq");
}

interface Palette {
  text: string;
  dim: string;
  faint: string;
  line: string;
  surface: string;
  accent: string;
  accent2: string;
  danger: string;
}

interface Layout {
  w: number;
  h: number;
  queueX: number;
  schedulerX: number;
  workerX: number;
  midY: number;
  dlqY: number;
}

const EASE = 0.18;
const VIA_EASE = 0.3;
const DOT = 4.5;

/**
 * Matches the engine's `SETTLE_MS`. Kept as its own constant rather than
 * imported because it is a fade curve, not a rule: if the two drift the dot
 * fades early or pops, and neither breaks the simulation.
 */
const SETTLE_FADE_MS = 1500;

function readPalette(el: HTMLElement): Palette {
  const style = getComputedStyle(el);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    text: read("--text", "#ececf4"),
    dim: read("--text-dim", "#8c8ca3"),
    faint: read("--text-faint", "#5c5c70"),
    line: read("--line", "rgba(255,255,255,.08)"),
    surface: read("--surface-2", "#13131d"),
    accent: read("--accent", "#1f9d54"),
    accent2: read("--accent-2", "#3bbf72"),
    // No token for failure: the palette is single-accent by design, so the
    // dead-letter state borrows a fixed warm red rather than inventing a token.
    danger: "#e2564b",
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private particles = new Map<string, Particle>();
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: read via `const { palette } = this` in every draw method, which the rule doesn't track
  private palette: Palette;
  private layout: Layout = { w: 0, h: 0, queueX: 0, schedulerX: 0, workerX: 0, midY: 0, dlqY: 0 };
  private frame = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private reducedMotion: boolean,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas context unavailable");
    this.ctx = ctx;
    this.palette = readPalette(canvas);
  }

  /** Re-reads theme tokens — call on theme change, not every frame. */
  refreshTheme(): void {
    this.palette = readPalette(this.canvas);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout = {
      w: rect.width,
      h: rect.height,
      queueX: rect.width * 0.14,
      schedulerX: rect.width * 0.45,
      workerX: rect.width * 0.76,
      midY: rect.height * 0.44,
      dlqY: rect.height * 0.86,
    };
    this.palette = readPalette(this.canvas);
  }

  private target(job: Job, snapshot: EngineSnapshot, queueIndex: number): { x: number; y: number } {
    const { queueX, schedulerX, midY, dlqY, h } = this.layout;

    if (job.state === "running" && job.workerId !== undefined) {
      const slot = this.workerSlot(job.workerId, snapshot.workers.length);
      return { x: slot.x + slot.w / 2, y: slot.y + slot.h / 2 };
    }
    if (job.state === "dead" || job.state === "dropped") {
      // Just above the box, spread across its width: landing on the centre
      // would bury the "DLQ · n" label under the dots that produced the n.
      // The spread is hashed off the job id so a dot does not drift while it
      // fades.
      return { x: schedulerX + ((hash(job.id) % 76) - 38), y: dlqY - 27 };
    }
    if (job.state === "retrying") {
      // Orbit the scheduler while the backoff runs down; the angle is stable
      // per job so a retrying dot doesn't jump between frames.
      const angle = (hash(job.id) % 360) * (Math.PI / 180);
      const radius = 46 + (job.attempt % 4) * 13;
      return { x: schedulerX + Math.cos(angle) * radius, y: midY + Math.sin(angle) * radius };
    }
    const column = Math.floor(queueIndex / 14);
    const row = queueIndex % 14;
    return { x: queueX - column * 16, y: h * 0.16 + row * 15 };
  }

  private workerSlot(id: number, total: number) {
    const { workerX, midY } = this.layout;
    const cols = total > 6 ? 3 : 2;
    const w = 62;
    const h = 34;
    const gap = 10;
    const rows = Math.ceil(total / cols);
    const col = id % cols;
    const row = Math.floor(id / cols);
    return {
      x: workerX - (cols * (w + gap) - gap) / 2 + col * (w + gap),
      y: midY - (rows * (h + gap) - gap) / 2 + row * (h + gap),
      w,
      h,
    };
  }

  draw(snapshot: EngineSnapshot): void {
    const { ctx, palette, layout } = this;
    this.frame++;
    ctx.clearRect(0, 0, layout.w, layout.h);

    this.drawWires(snapshot);
    this.drawQueueColumn(snapshot);
    this.drawScheduler(snapshot);
    this.drawWorkers(snapshot);
    this.drawDlq(snapshot);

    // Jobs last so dots sit above the furniture.
    const pendingIndex = new Map<string, number>();
    let index = 0;
    for (const job of snapshot.jobs) {
      if (job.state === "pending") pendingIndex.set(job.id, index++);
    }

    const live = new Set<string>();
    const scheduler = { x: layout.schedulerX, y: layout.midY };
    // `settling` is what a job that just dead-lettered looks like on its way
    // down. Without it the engine drops the job the instant it is dead-lettered
    // and the dot disappears at the scheduler, so the DLQ counter climbs with
    // nothing ever seen to arrive in it.
    for (const job of [...snapshot.jobs, ...snapshot.settling]) {
      live.add(job.id);
      const to = this.target(job, snapshot, pendingIndex.get(job.id) ?? 0);
      const lane = laneOf(job);
      const particle = this.particles.get(job.id) ?? {
        x: -20,
        y: layout.h * 0.2,
        born: this.frame,
        lane,
        via: null,
      };

      // A dot that has just changed lane heads for the scheduler first, then
      // for wherever it is actually going, so the two wires carry the traffic
      // instead of the dots flying over them.
      if (particle.lane !== lane) {
        if (routesThroughScheduler(particle.lane, lane)) particle.via = scheduler;
        particle.lane = lane;
      }

      // The leg into the scheduler runs hotter than the settle at the far end:
      // short tasks finish before a dot could otherwise cross the board, and a
      // dot that never arrives reads as a stall rather than as speed.
      const ease = this.reducedMotion ? 1 : particle.via ? VIA_EASE : EASE;
      const leg = particle.via ?? to;
      particle.x += (leg.x - particle.x) * ease;
      particle.y += (leg.y - particle.y) * ease;
      if (particle.via && Math.hypot(leg.x - particle.x, leg.y - particle.y) < 10) {
        particle.via = null;
      }
      this.particles.set(job.id, particle);

      const failed = job.state === "retrying" || job.state === "dead" || job.state === "dropped";
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, job.state === "running" ? DOT + 1.5 : DOT, 0, Math.PI * 2);
      ctx.fillStyle = failed
        ? palette.danger
        : job.state === "running"
          ? palette.accent2
          : palette.dim;
      ctx.globalAlpha = job.state === "pending" ? 0.75 : this.settleAlpha(job, snapshot.now);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const id of this.particles.keys()) {
      if (!live.has(id)) this.particles.delete(id);
    }
  }

  /**
   * A dead-lettered dot fades over the back half of its settle window, so it
   * reads as landing in the DLQ rather than blinking out of existence once the
   * engine stops reporting it.
   */
  private settleAlpha(job: Job, now: number): number {
    if (job.state !== "dead" && job.state !== "dropped") return 1;
    const age = now - (job.finishedAt ?? now);
    return Math.max(0.15, Math.min(1, (SETTLE_FADE_MS - age) / SETTLE_FADE_MS));
  }

  private label(text: string, x: number, y: number, align: CanvasTextAlign = "center"): void {
    const { ctx, palette } = this;
    ctx.font = "600 10px var(--font-mono), ui-monospace, monospace";
    ctx.fillStyle = palette.faint;
    ctx.textAlign = align;
    ctx.letterSpacing = "0.14em";
    ctx.fillText(text.toUpperCase(), x, y);
    ctx.letterSpacing = "0px";
  }

  private drawWires(snapshot: EngineSnapshot): void {
    const { ctx, palette, layout } = this;
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(layout.queueX + 18, layout.midY);
    ctx.lineTo(layout.schedulerX - 34, layout.midY);
    ctx.moveTo(layout.schedulerX + 34, layout.midY);
    ctx.lineTo(layout.workerX - 74, layout.midY);
    ctx.stroke();

    if (this.reducedMotion) return;
    // A spark per wire, phase-offset, purely decorative.
    const phase = (this.frame % 90) / 90;
    for (const [from, to] of [
      [layout.queueX + 18, layout.schedulerX - 34],
      [layout.schedulerX + 34, layout.workerX - 74],
    ]) {
      const busy = snapshot.workers.some((w) => w.jobId);
      if (!busy) continue;
      ctx.beginPath();
      ctx.arc(from + (to - from) * phase, layout.midY, 2, 0, Math.PI * 2);
      ctx.fillStyle = palette.accent;
      ctx.fill();
    }
  }

  private drawQueueColumn(snapshot: EngineSnapshot): void {
    const pending = snapshot.jobs.filter((j) => j.state === "pending").length;
    this.label("queue", this.layout.queueX, this.layout.h * 0.1, "center");
    const { ctx, palette, layout } = this;
    ctx.font = "500 12px var(--font-mono), ui-monospace, monospace";
    ctx.fillStyle = palette.dim;
    ctx.textAlign = "center";
    ctx.fillText(`${pending} pending`, layout.queueX, layout.h * 0.1 + 16);
  }

  private drawScheduler(snapshot: EngineSnapshot): void {
    const { ctx, palette, layout } = this;
    const busy = snapshot.workers.filter((w) => w.jobId).length;
    const r = 30;
    ctx.beginPath();
    ctx.arc(layout.schedulerX, layout.midY, r, 0, Math.PI * 2);
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (busy > 0 && !this.reducedMotion) {
      const pulse = (this.frame % 60) / 60;
      ctx.beginPath();
      ctx.arc(layout.schedulerX, layout.midY, r + pulse * 14, 0, Math.PI * 2);
      ctx.strokeStyle = palette.accent;
      ctx.globalAlpha = 0.28 * (1 - pulse);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    this.label("scheduler", layout.schedulerX, layout.midY - r - 16);
    ctx.font = "500 11px var(--font-mono), ui-monospace, monospace";
    ctx.fillStyle = palette.dim;
    ctx.textAlign = "center";
    ctx.fillText("rust · tokio", layout.schedulerX, layout.midY + r + 20);
  }

  private drawWorkers(snapshot: EngineSnapshot): void {
    const { ctx, palette, layout } = this;
    const total = snapshot.workers.length;
    this.label(
      "workers",
      layout.workerX,
      layout.midY - (Math.ceil(total / (total > 6 ? 3 : 2)) * 44) / 2 - 18,
    );

    for (const worker of snapshot.workers) {
      const slot = this.workerSlot(worker.id, total);
      roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 7);
      ctx.fillStyle = palette.surface;
      ctx.fill();
      ctx.strokeStyle = worker.alive ? palette.line : palette.danger;
      ctx.lineWidth = 1;
      ctx.stroke();

      if (!worker.alive) {
        ctx.font = "500 10px var(--font-mono), ui-monospace, monospace";
        ctx.fillStyle = palette.danger;
        ctx.textAlign = "center";
        ctx.fillText("down", slot.x + slot.w / 2, slot.y + slot.h / 2 + 3);
        continue;
      }

      if (!worker.jobId) continue;
      const job = snapshot.jobs.find((j) => j.id === worker.jobId);
      if (!job?.startedAt || !job.durationMs) continue;
      const progress = Math.min(1, (snapshot.now - job.startedAt) / job.durationMs);
      roundRect(ctx, slot.x, slot.y + slot.h - 3, slot.w * progress, 3, 2);
      ctx.fillStyle = palette.accent;
      ctx.fill();
    }
  }

  private drawDlq(snapshot: EngineSnapshot): void {
    const { ctx, palette, layout } = this;
    const count = snapshot.dlq.length;
    roundRect(ctx, layout.schedulerX - 52, layout.dlqY - 17, 104, 34, 8);
    ctx.strokeStyle = count > 0 ? palette.danger : palette.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = "500 11px var(--font-mono), ui-monospace, monospace";
    ctx.fillStyle = count > 0 ? palette.danger : palette.faint;
    ctx.textAlign = "center";
    ctx.fillText(`DLQ · ${count}`, layout.schedulerX, layout.dlqY + 4);
  }
}

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
