/**
 * Download collection from the command line.
 *
 * The same code the nightly cron runs, without the HTTP layer — for the first
 * backfill, for debugging a registry that started failing, and for seeding the
 * package list before anyone has signed in.
 *
 *   pnpm --filter @byteveda/admin collect --seed
 *   pnpm --filter @byteveda/admin collect
 */
import { closeDb, getDb, projectPackages } from "@byteveda/db";
import { catalogueSuggestions } from "../src/lib/stats/catalogue";
import { collectAll } from "../src/lib/stats/collect";

async function seed() {
  const suggestions = catalogueSuggestions();

  const added = await getDb()
    .insert(projectPackages)
    .values(suggestions)
    .onConflictDoNothing({ target: [projectPackages.ecosystem, projectPackages.packageName] })
    .returning({ id: projectPackages.id });

  console.log(
    `Seeded ${added.length} of ${suggestions.length} catalogue packages (the rest were already listed).`,
  );
}

async function main() {
  if (process.argv.includes("--seed")) await seed();

  const outcomes = await collectAll();
  if (outcomes.length === 0) {
    console.log("No packages are being tracked. Run with --seed first.");
    return;
  }

  for (const outcome of outcomes) {
    const mark = { ok: "ok", failed: "FAILED", unsupported: "n/a" }[outcome.status];
    console.log(
      `  ${mark.padEnd(7)} ${outcome.ecosystem.padEnd(7)} ${outcome.packageName.padEnd(34)} ${outcome.detail}`,
    );
  }

  const failed = outcomes.filter((outcome) => outcome.status === "failed").length;
  console.log(`\n${outcomes.length} packages, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
