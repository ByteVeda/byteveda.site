import { type NextRequest, NextResponse } from "next/server";
import { collectAll } from "@/lib/stats/collect";

export const dynamic = "force-dynamic";
/** Registries are slow and there are several; the default 10s is not enough. */
export const maxDuration = 300;

/**
 * The nightly collection.
 *
 * Authenticated by a shared secret rather than a session, because the caller is
 * Vercel Cron. The route sits outside the proxy's matcher for the same reason.
 */
function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const outcomes = await collectAll();
  const failed = outcomes.filter((outcome) => outcome.status === "failed");

  // 207 when some packages failed: the run happened, and the body says what
  // did not. A blanket 200 would hide a registry that has been down for a week.
  return NextResponse.json(
    {
      collected: outcomes.length,
      failed: failed.length,
      outcomes,
    },
    { status: failed.length > 0 ? 207 : 200 },
  );
}
