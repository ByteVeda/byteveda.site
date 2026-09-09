/**
 * Checks that REDIS_URL carries an announcement.
 *
 * Realtime failures are silent by nature — the console simply never updates —
 * so this makes the transport testable before wondering why a page is stale.
 *
 *   pnpm --filter @byteveda/admin realtime:check              round trip here
 *   pnpm --filter @byteveda/admin realtime:check --listen     wait for another process
 *
 * Run `--listen` in one terminal and the plain form in another to prove the
 * cross-instance path, which is the whole reason Redis is involved.
 */
import {
  closeRealtime,
  isDistributed,
  subscriberReady,
  subscribersChanged,
} from "../src/lib/realtime";

const TIMEOUT_MS = 8000;

async function main() {
  if (!isDistributed()) {
    console.log("REDIS_URL is not set — announcements stay in this process.");
    console.log("That is correct for one server, and stale for several.");
    return;
  }

  const url = new URL(process.env.REDIS_URL as string);
  console.log(`Redis: ${url.hostname}:${url.port}`);

  if (process.argv.includes("--listen")) {
    subscribersChanged.subscribe(() => console.log(`heard subscribers:changed`));
    console.log("Listening. Run the check in another terminal; Ctrl-C to stop.");
    // Nothing else to do; the subscription keeps the process alive.
    await new Promise(() => {});
    return;
  }

  const heard = new Promise<boolean>((resolve) => {
    const stop = subscribersChanged.subscribe(() => {
      stop();
      resolve(true);
    });
    setTimeout(() => {
      stop();
      resolve(false);
    }, TIMEOUT_MS);
  });

  // Redis keeps no backlog, so publishing before SUBSCRIBE lands is a message
  // sent to nobody.
  await subscriberReady();
  subscribersChanged.publish();

  if (await heard) {
    console.log("Round trip works. Announcements will reach every instance.");
  } else {
    console.error(`No message came back within ${TIMEOUT_MS / 1000}s.`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeRealtime);
