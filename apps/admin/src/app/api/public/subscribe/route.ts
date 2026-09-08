import { type NextRequest, NextResponse } from "next/server";
import { originOf } from "@/lib/auth/urls";
import { subscribe } from "@/lib/subscribers/service";

export const dynamic = "force-dynamic";

/** Only the ByteVeda sites may post here from a browser. */
const ALLOWED_ORIGINS = [
  "https://byteveda.org",
  "https://www.byteveda.org",
  "https://flexiq.byteveda.org",
  "https://docs.byteveda.org",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin &&
    (ALLOWED_ORIGINS.includes(origin) ||
      (process.env.NODE_ENV !== "production" && origin.startsWith("http://localhost:")));

  return allowed
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        vary: "origin",
      }
    : { vary: "origin" };
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

/**
 * Newsletter signup, called by the public sites.
 *
 * The response never distinguishes a new address from one already on the list —
 * doing so would let anyone use this endpoint to test whether a given person is
 * subscribed.
 */
export async function POST(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"));

  let email: unknown;
  let source: unknown;
  try {
    ({ email, source } = (await request.json()) as { email?: unknown; source?: unknown });
  } catch {
    return NextResponse.json({ error: "expected a json body" }, { status: 400, headers });
  }

  if (typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400, headers });
  }

  const result = await subscribe({
    email,
    source: typeof source === "string" ? source.slice(0, 60) : "web",
    origin: originOf(request),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400, headers });
  }

  return NextResponse.json({ message: "Check your inbox for a confirmation link." }, { headers });
}
