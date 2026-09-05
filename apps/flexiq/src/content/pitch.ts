/**
 * Copy for the marketing home page.
 *
 * Deliberately not a port of the docs landing page. The docs site sells the
 * happy path with a feature grid, which is what every queue's home page does
 * and which a reader has no reason to believe. This page argues one thing —
 * that the broker is the part you can delete — and then proves it by letting
 * the reader break a running queue.
 */

export const HERO = {
  headline: "Delete Redis",
  headlineAccent: "from your stack.",
  lede: "FlexiQ is a task queue with a Rust core and no message broker. Jobs, results, rate limits and cron schedules live in one SQLite file. Python, Node and Java are peers over that file — enqueue in one, run workers in another.",
} as const;

/** The hero's proof artifact: a process list, before and after. */
export const PROCESS_LIST = {
  command: "ps aux | grep -E 'redis|celery|flexiq'",
  gone: ["redis-server *:6379", "celery -A myapp beat", "celery -A myapp worker"],
  kept: "flexiq worker --app tasks:queue",
} as const;

export interface LedgerRow {
  label: string;
  before: number;
  after: number;
  note: string;
}

/**
 * The comparison, as counts rather than a feature table. Every number here is
 * a thing the reader currently operates, so each one is checkable against
 * their own deployment rather than taken on trust.
 */
export const LEDGER: LedgerRow[] = [
  {
    label: "Processes to run",
    before: 3,
    after: 1,
    note: "Redis, a worker and a beat daemon collapse into one worker.",
  },
  {
    label: "Network services to secure",
    before: 1,
    after: 0,
    note: "No port to bind, firewall, authenticate or upgrade.",
  },
  {
    label: "Places job state lives",
    before: 2,
    after: 1,
    note: "Broker and result backend become one file with one transaction.",
  },
  {
    label: "Add-ons for a dashboard",
    before: 1,
    after: 0,
    note: "Flower is a separate install. FlexiQ ships its dashboard in the box.",
  },
];

export interface Experiment {
  id: string;
  /** Imperative and destructive — the button reads like something you'd regret. */
  action: string;
  question: string;
  /** What the reader should watch for, stated as an invariant the queue holds. */
  invariant: string;
  /** The configuration that produces the behaviour, as real SDK code. */
  code: string;
  /** Docs path backing the claim, resolved against the reader's SDK. */
  href: string;
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: "kill",
    action: "kill -9 a worker",
    question: "What happens to the job it was holding?",
    invariant:
      "It goes back on the queue. The claim is a lease in the database, not state in the process, so when the lease expires the scheduler re-dispatches the job to somebody else. Nothing is lost and nothing is run twice.",
    code: `# The worker holds a lease, not the job.
# Kill it and the scheduler reclaims the work.
queue = Queue(db_path="tasks.db", workers=6)`,
    href: "guides/core/workers",
  },
  {
    id: "fail",
    action: "make 80% of calls fail",
    question: "Does the retry storm take the downstream with it?",
    invariant:
      "No — the delays fan out. FlexiQ uses Full Jitter: each retry draws its delay uniformly from [0, cap], and the cap doubles. The spread widens as the outage continues instead of stacking every client on the same second. Watch the red dots: most jobs get through on a later attempt, and the ones that never do fall into the dead-letter queue rather than looping forever.",
    code: `@queue.task(max_retries=3, retry_backoff=0.6)
def fetch_profile(user_id):
    return api.get(f"/users/{user_id}")`,
    href: "guides/reliability/retries",
  },
  {
    id: "flood",
    action: "flood a 5/s rate limit",
    question: "Do the extra jobs get dropped?",
    invariant:
      "Not unless you ask for that. A token bucket paces dispatch and the excess waits its turn — on_excess='defer' is the default. Switch it to 'drop' and the queue will shed load instead, which is a decision you make rather than one made for you.",
    code: `@queue.task(rate_limit="5/s", on_excess="defer")
def send_email(to, subject, body):
    smtp.send(to, subject, body)`,
    href: "guides/reliability/flow-control",
  },
  {
    id: "dlq",
    action: "burn the retry budget",
    question: "Where do the jobs that never succeed end up?",
    invariant:
      "In the dead-letter queue, with the arguments and the failure history attached. They are rows you can query and replay once the downstream is healthy — not a log line and a shrug.",
    code: `@queue.task(max_retries=3)
def charge_card(order_id):
    ...

dead = queue.dead_letters(limit=20)
queue.retry_dead(dead[0]["id"])`,
    href: "guides/reliability/error-handling",
  },
];

/**
 * The interop claim, which is the genuinely unusual one: three SDKs are peers
 * over one store rather than one reference implementation and two ports.
 */
export const INTEROP = {
  files: [
    {
      role: "Your API enqueues",
      filename: "server.ts",
      lang: "ts" as const,
      code: `import { Queue } from "@byteveda/flexiq";

const queue = new Queue({ dbPath: "tasks.db" });

app.post("/reports", async (req, res) => {
  const id = queue.enqueue("build_report", [req.body.orgId]);
  res.json({ jobId: id });
});`,
    },
    {
      role: "Your workers run",
      filename: "worker.py",
      lang: "python" as const,
      code: `from flexiq import Queue

queue = Queue(db_path="tasks.db")

@queue.task(name="build_report", max_retries=3)
def build_report(org_id):
    return pandas_pipeline(org_id)

# $ flexiq worker --app worker:queue`,
    },
  ],
  store: "tasks.db",
} as const;

/**
 * The transparency section. FlexiQ has no adoption numbers to lean on, so the
 * argument has to be the engineering itself — quoted from the repository
 * rather than described.
 */
export const SOURCE = {
  claim: "Retries use Full Jitter, and the cap grows exponentially.",
  path: "crates/flexiq-core/src/resilience/retry.rs",
  permalink: "crates/flexiq-core/src/resilience/retry.rs",
  rust: `pub fn next_retry_at(&self, retry_count: i32) -> i64 {
    if let Some(ref delays) = self.custom_delays_ms {
        if let Some(&custom) = delays.get(retry_count as usize) {
            return now_millis() + custom;
        }
    }

    let cap = self
        .base_delay_ms
        .saturating_mul(1i64 << retry_count.min(30))
        .min(self.max_delay_ms);

    now_millis() + full_jitter(cap)
}`,
  api: `@queue.task(
    max_retries=5,
    retry_backoff=1.0,
    max_retry_delay=300,
)
def charge_card(order_id):
    ...`,
} as const;
