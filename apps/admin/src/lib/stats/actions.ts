"use server";

import { ECOSYSTEMS, type Ecosystem, getDb, projectPackages } from "@byteveda/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { catalogueSuggestions } from "./catalogue";
import { collectAll, collectPackage } from "./collect";

export type StatsResult = { ok: boolean; message: string };

/** Fills the table from the project catalogue. Existing rows are left alone. */
export async function seedFromCatalogue(): Promise<StatsResult> {
  await requireSession();

  const suggestions = catalogueSuggestions();
  if (suggestions.length === 0) return { ok: false, message: "Nothing to add." };

  const inserted = await getDb()
    .insert(projectPackages)
    .values(suggestions)
    .onConflictDoNothing({ target: [projectPackages.ecosystem, projectPackages.packageName] })
    .returning({ id: projectPackages.id });

  revalidatePath("/stats");
  return {
    ok: true,
    message:
      inserted.length === 0
        ? "Everything in the catalogue was already listed."
        : `Added ${inserted.length} package${inserted.length === 1 ? "" : "s"}. Check the names, then collect.`,
  };
}

export async function addPackage(input: {
  projectSlug: string;
  ecosystem: string;
  packageName: string;
}): Promise<StatsResult> {
  await requireSession();

  const projectSlug = input.projectSlug.trim();
  const packageName = input.packageName.trim();

  if (!projectSlug) return { ok: false, message: "Choose a project." };
  if (!packageName) return { ok: false, message: "Give the package name." };
  if (!ECOSYSTEMS.includes(input.ecosystem as Ecosystem)) {
    return { ok: false, message: "Unknown registry." };
  }

  const [added] = await getDb()
    .insert(projectPackages)
    .values({ projectSlug, ecosystem: input.ecosystem as Ecosystem, packageName })
    .onConflictDoNothing({ target: [projectPackages.ecosystem, projectPackages.packageName] })
    .returning({ id: projectPackages.id });

  revalidatePath("/stats");

  if (!added) return { ok: false, message: "That package is already listed." };

  // Collect immediately: an entry with no numbers is indistinguishable from a
  // wrong one, and the operator is here now to see which it was.
  const outcome = await collectPackage(
    (await getDb().select().from(projectPackages).where(eq(projectPackages.id, added.id)))[0],
  );

  revalidatePath("/stats");
  return { ok: outcome.status !== "failed", message: `${packageName}: ${outcome.detail}` };
}

export async function removePackage(id: string): Promise<StatsResult> {
  await requireSession();

  await getDb().delete(projectPackages).where(eq(projectPackages.id, id));
  revalidatePath("/stats");
  return { ok: true, message: "Removed." };
}

/** The same work the cron does, on demand. */
export async function collectNow(): Promise<StatsResult> {
  await requireSession();

  const outcomes = await collectAll();
  revalidatePath("/stats");

  if (outcomes.length === 0) return { ok: false, message: "No packages to collect." };

  const failed = outcomes.filter((outcome) => outcome.status === "failed");
  const ok = outcomes.filter((outcome) => outcome.status === "ok").length;

  return {
    ok: failed.length === 0,
    message: failed.length
      ? `${ok} collected, ${failed.length} failed: ${failed.map((outcome) => outcome.packageName).join(", ")}`
      : `Collected ${ok} package${ok === 1 ? "" : "s"}.`,
  };
}
