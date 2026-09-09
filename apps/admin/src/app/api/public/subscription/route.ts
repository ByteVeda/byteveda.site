import { type NextRequest, NextResponse } from "next/server";
import { confirm, unsubscribe } from "@/lib/subscribers/service";

export const dynamic = "force-dynamic";

/**
 * Acts on a subscription token.
 *
 * POST rather than a side effect on the page's GET: mail clients and link
 * scanners follow emailed URLs, and a confirmation that happened because
 * something prefetched the link is not consent. The page reads the state and
 * offers a button; this is what the button calls.
 *
 * Public by design — the token is the credential. It is 24 random bytes, and
 * the only thing it can do is set the state of the one row it names.
 */
export async function POST(request: NextRequest) {
  let token: unknown;
  let action: unknown;

  try {
    ({ token, action } = (await request.json()) as { token?: unknown; action?: unknown });
  } catch {
    return NextResponse.json({ error: "expected a json body" }, { status: 400 });
  }

  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  if (action !== "confirm" && action !== "unsubscribe") {
    return NextResponse.json({ error: "action must be confirm or unsubscribe" }, { status: 400 });
  }

  const result = action === "confirm" ? await confirm(token) : await unsubscribe(token);

  // A token that names nothing is the only failure here, and the caller is the
  // person holding the link — telling them plainly is the point.
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
