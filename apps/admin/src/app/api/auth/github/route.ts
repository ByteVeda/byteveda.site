import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/auth/github";
import { STATE_COOKIE } from "@/lib/auth/session";
import { callbackUrl, originOf, safeNext } from "@/lib/auth/urls";

export const dynamic = "force-dynamic";

/** Starts the OAuth handshake. */
export function GET(request: NextRequest) {
  const state = randomBytes(24).toString("base64url");
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  /*
   * The whole handshake has to happen on one origin. `ADMIN_URL` decides where
   * GitHub sends the browser back to, so starting from anywhere else sets the
   * state cookie on a host the callback never sees — which surfaces as
   * `error=state` and looks like a signing problem rather than a wrong URL.
   * Bounce to the canonical origin first and let it start over.
   */
  const canonical = originOf(request);
  if (!request.url.startsWith(`${canonical}/`)) {
    const start = new URL("/api/auth/github", canonical);
    start.searchParams.set("next", next);
    return NextResponse.redirect(start);
  }

  const response = NextResponse.redirect(authorizeUrl(callbackUrl(request), state));

  // The state is echoed back by GitHub and compared against this cookie, which
  // is what stops a third party from replaying a callback into your session.
  response.cookies.set(STATE_COOKIE, `${state}:${next}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return response;
}
