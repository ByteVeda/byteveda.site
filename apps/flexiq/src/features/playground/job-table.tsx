"use client";

import type { EngineSnapshot, Job } from "@byteveda/flexiq-sim";

const STATE_LABEL: Record<Job["state"], string> = {
  pending: "pending",
  running: "running",
  retrying: "retrying",
  succeeded: "succeeded",
  dead: "dead-letter",
  dropped: "dropped",
};

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function JobTable({ snapshot, recent }: { snapshot: EngineSnapshot; recent: Job[] }) {
  const live = [...snapshot.jobs].sort((a, b) => a.seq - b.seq).slice(0, 10);
  const rows = [...live, ...snapshot.dlq.slice(-4).reverse(), ...recent].slice(0, 16);

  return (
    <div className="pg-panel">
      <div className="pg-panel-head">
        <h3>Jobs</h3>
        <span>{snapshot.counters.enqueued} enqueued</span>
      </div>
      <table className="pg-table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Task</th>
            <th>State</th>
            <th>Try</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((job) => (
            <tr key={job.id} data-state={job.state}>
              <td>{job.id}</td>
              <td>{job.task}</td>
              <td>
                <span className="pg-state">{STATE_LABEL[job.state]}</span>
                {job.state === "retrying" && (
                  <span className="pg-eta">
                    {" "}
                    in {seconds(Math.max(0, job.runAt - snapshot.now))}
                  </span>
                )}
              </td>
              <td>{job.attempt + 1}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="pg-empty">
                Queue is empty — burst some jobs.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
