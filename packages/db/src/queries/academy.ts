import { eq } from "drizzle-orm";
import { getDb } from "../client";
import type { SampleKind } from "../constants";
import { sampleRequests } from "../schema/academy";

/** Postgres `unique_violation`. The only error here that is not an incident. */
const UNIQUE_VIOLATION = "23505";

/**
 * Whether a thrown thing is the unique constraint firing.
 *
 * The chain has to be walked rather than the top checked: drizzle wraps what
 * `pg` threw in a `DrizzleQueryError` and hangs the original off `cause`, so
 * the `code` is one level down — and which level is a detail of the driver
 * version, not something worth pinning. Reading it as "is there a 23505
 * anywhere in here" is the part that stays true.
 */
export function isUniqueViolation(error: unknown): boolean {
  for (let cause = error, depth = 0; cause && depth < 5; depth++) {
    if (typeof cause !== "object") return false;
    if ((cause as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
    cause = (cause as { cause?: unknown }).cause;
  }
  return false;
}

export type SampleClaim = {
  email: string;
  reference: string;
  kind: SampleKind;
  chapterId?: string | null;
  title: string;
  detail?: string;
  request?: Record<string, unknown> | null;
  listValue?: number;
};

export type ClaimResult =
  | { ok: true; claimedAt: Date }
  /** The address already has its sample. `at` is when it took it. */
  | { ok: false; at: Date | null };

/** Lowercased once, here, so no caller has to remember to. */
function normalise(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Whether this address has already had its free sample.
 *
 * Advisory only — see `claimSample`. Worth asking because it turns the common
 * case into a sentence the visitor can act on before they hit send, rather than
 * a rejection after.
 */
export async function hasClaimedSample(email: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: sampleRequests.id })
    .from(sampleRequests)
    .where(eq(sampleRequests.email, normalise(email)))
    .limit(1);

  return Boolean(row);
}

/**
 * Takes the address's one sample, or reports that it is already spent.
 *
 * The insert *is* the check. Two requests from the same address arriving
 * together both pass `hasClaimedSample`, and the unique index is what decides
 * which of them is the second — so a violation here is an answer, not a
 * failure. Anything else is a real error and is left to throw.
 *
 * Nothing is sent from inside this. The caller records the claim first and
 * mails afterwards: a row with no email is a support question, an email with no
 * row is a free catalogue.
 */
export async function claimSample(claim: SampleClaim): Promise<ClaimResult> {
  const email = normalise(claim.email);

  try {
    const [row] = await getDb()
      .insert(sampleRequests)
      .values({
        email,
        reference: claim.reference,
        kind: claim.kind,
        chapterId: claim.chapterId ?? null,
        title: claim.title,
        detail: claim.detail ?? "",
        request: claim.request ?? null,
        listValue: claim.listValue ?? 0,
      })
      .returning({ createdAt: sampleRequests.createdAt });

    return { ok: true, claimedAt: row?.createdAt ?? new Date() };
  } catch (cause) {
    if (isUniqueViolation(cause)) return { ok: false, at: await claimedAt(email) };
    throw cause;
  }
}

/**
 * Gives the address its sample back.
 *
 * For the caller whose send failed after the claim was taken. The row is a
 * lock as much as a record, and a lock held on behalf of an email that was
 * never delivered is the one case where deleting it is the honest thing —
 * otherwise a Resend outage permanently spends the sample of everyone who
 * tried during it.
 */
export async function releaseSample(email: string): Promise<void> {
  await getDb()
    .delete(sampleRequests)
    .where(eq(sampleRequests.email, normalise(email)));
}

async function claimedAt(email: string): Promise<Date | null> {
  const [row] = await getDb()
    .select({ createdAt: sampleRequests.createdAt })
    .from(sampleRequests)
    .where(eq(sampleRequests.email, email))
    .limit(1);

  return row?.createdAt ?? null;
}
