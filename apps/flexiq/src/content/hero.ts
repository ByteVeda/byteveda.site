import type { Sdk } from "@/lib/docs";

export interface HeroPane {
  sdk: Sdk;
  filename: string;
  code: string;
}

/**
 * The hero snippet is a task a reader might actually have written — retries and
 * a provider rate limit on an email send — rather than `add(a, b)`. The toy
 * version belongs in a quickstart, where the point is the mechanics; here the
 * point is that the two hard parts are decorator arguments.
 */
export const HERO_PANES: HeroPane[] = [
  {
    sdk: "python",
    filename: "tasks.py",
    code: `from flexiq import Queue

queue = Queue(db_path="tasks.db")

@queue.task(max_retries=3, rate_limit="5/s")
def send_email(to, subject, body):
    smtp.send(to, subject, body)

send_email.delay("ada@example.com", "Welcome", "…")`,
  },
  {
    sdk: "node",
    filename: "tasks.ts",
    code: `import { Queue } from "@byteveda/flexiq";

const queue = new Queue({ dbPath: "tasks.db" });

queue.task("send_email", sendEmail, {
  maxRetries: 3,
  rateLimit: "5/s",
});

queue.enqueue("send_email", ["ada@example.com", "Welcome"]);`,
  },
  {
    sdk: "java",
    filename: "Tasks.java",
    code: `import org.byteveda.flexiq.*;
import org.byteveda.flexiq.task.Task;

Task<Email> send = Task.of("send_email", Email.class)
    .retries(3)
    .rateLimit("5/s");

try (FlexiQ queue = FlexiQ.builder().sqlite("tasks.db").open()) {
  queue.enqueue(send, new Email("ada@example.com", "Welcome"));
}`,
  },
];
