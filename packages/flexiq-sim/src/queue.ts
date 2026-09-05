import type { Job } from "./types";

/**
 * Dispatch order within a queue: higher priority first, then FIFO by enqueue
 * sequence. FlexiQ treats priority as a plain integer with no fixed scale, so
 * the only guarantee worth reproducing is the relative ordering.
 */
export function compareDispatch(a: Job, b: Job): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.seq - b.seq;
}

/** Jobs a worker may claim right now: waiting, and past their `runAt`. */
export function eligible(jobs: Iterable<Job>, now: number): Job[] {
  const out: Job[] = [];
  for (const job of jobs) {
    if ((job.state === "pending" || job.state === "retrying") && job.runAt <= now) out.push(job);
  }
  return out.sort(compareDispatch);
}
