import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/auth/github";
import { STATE_COOKIE } from "@/lib/auth/session";
import { callbackUrl, safeNext } from "@/lib/auth/urls";

export const dynamic = "force-dynamic";

/** Starts the OAuth handshake. */
export function GET(request: NextRequest) {
  const state = randomBytes(24).toString("base64url");
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  /*
   * The handshake has to run entirely on the origin named by `ADMIN_URL`, since
   * that is where GitHub sends the browser back to and therefore the only host
   * that can read the state cookie set below. Starting from anywhere else fails
   * as `error=state`, and the login page says so.
   *
   * Redirecting to the canonical origin here is not an option: Next reports
   * `request.url` as the local socket address whatever the proxy did, so a
   * comparison against it never matches and loops.
   */

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
