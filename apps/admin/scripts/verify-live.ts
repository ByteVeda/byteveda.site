/**
 * Proves the live path against a running console: a signed inbound webhook
 * reaches a page that is already open.
 *
 * Not part of CI — it needs a server, a database and a session, which is exactly
 * the combination unit tests cannot have. It exists because the thing worth
 * checking here is the seam between four components (webhook → Postgres → bus →
 * event stream), and every one of them passes its own tests while the seam is
 * broken.
 *
 *   ADMIN_ORIGIN=http://127.0.0.1:3103 \
 *   ADMIN_SESSION=<token> RESEND_WEBHOOK_SECRET=<secret> \
 *   node --import tsx scripts/verify-live.ts
 */
import { createHmac } from "node:crypto";

const ORIGIN = process.env.ADMIN_ORIGIN ?? "http://127.0.0.1:3103";
const SESSION = process.env.ADMIN_SESSION ?? "";
const SECRET = process.env.RESEND_WEBHOOK_SECRET ?? "";

/** Same construction as `lib/email/webhook.ts` verifies. */
function sign(id: string, timestamp: string, body: string): string {
  const key = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

async function main() {
  if (!SESSION || !SECRET) throw new Error("ADMIN_SESSION and RESEND_WEBHOOK_SECRET are required.");

  const stream = await fetch(`${ORIGIN}/api/inbox/stream`, {
    headers: { cookie: `bv_admin_session=${SESSION}`, accept: "text/event-stream" },
  });

  if (!stream.ok || !stream.body) {
    throw new Error(`the stream would not open: ${stream.status}`);
  }

  const reader = stream.body.getReader();
  const decoder = new TextDecoder();

  const frames: string[] = [];
  const collecting = (async () => {
    for (let i = 0; i < 3; i += 1) {
      const { value, done } = await reader.read();
      if (done) break;
      frames.push(decoder.decode(value));
    }
  })();

  // Give the subscription a moment to land before announcing into it.
  await new Promise((resolve) => setTimeout(resolve, 300));

  const body = JSON.stringify({
    type: "email.received",
    data: {
      email_id: `verify-${Date.now()}`,
      from: '"Grace Hopper" <grace@example.test>',
      to: ["conduct@byteveda.org"],
      subject: "Nanoseconds",
    },
  });

  const id = "msg_verify";
  const timestamp = String(Math.floor(Date.now() / 1000));

  const posted = await fetch(`${ORIGIN}/api/webhooks/resend`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${sign(id, timestamp, body)}`,
    },
    body,
  });

  console.log(`webhook  ${posted.status} ${await posted.text()}`);

  await Promise.race([collecting, new Promise((resolve) => setTimeout(resolve, 3000))]);
  await reader.cancel();

  const received = frames.join("");
  console.log(`stream   ${JSON.stringify(received)}`);

  const changed = received.includes("event: change");
  console.log(changed ? "PASS: the open page was told" : "FAIL: nothing reached the stream");
  if (!changed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
