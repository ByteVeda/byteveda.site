import { type NextRequest, NextResponse } from "next/server";
import {
  callbackUrl,
  createSession,
  originOf,
  SESSION_COOKIE,
  STATE_COOKIE,
  safeEqual,
  safeNext,
  sessionCookieOptions,
} from "@/features/auth";
import { admit } from "@/features/members";
import { exchangeCode, fetchUser } from "@/lib/github/client";
import { clientIp, userAgent } from "@/shared/request";

export const dynamic = "force-dynamic";

/** Reason codes the login page knows how to explain. */
type Failure = "denied" | "suspended" | "state" | "exchange" | "config";

function fail(request: NextRequest, reason: Failure) {
  // `originOf`, never `nextUrl.origin`: behind a tunnel the latter combines the
  // forwarded protocol with the rewritten host and yields `https://localhost:3000`,
  // which the browser rejects outright.
  const url = new URL("/login", originOf(request));
  url.searchParams.set("error", reason);
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const stored = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !returnedState || !stored) return fail(request, "state");

  const separator = stored.indexOf(":");
  const expectedState = separator === -1 ? stored : stored.slice(0, separator);
  const next = safeNext(separator === -1 ? "/" : stored.slice(separator + 1));

  if (!safeEqual(expectedState, returnedState)) return fail(request, "state");

  let profile: Awaited<ReturnType<typeof fetchUser>>;
  try {
    profile = await fetchUser(await exchangeCode(code, callbackUrl(request)));
  } catch (error) {
    console.error("[auth] GitHub handshake failed", error);
    // A missing client id or secret surfaces here too, and the operator needs
    // to be able to tell that apart from GitHub saying no.
    return fail(
      request,
      error instanceof Error && /is not set/.test(error.message) ? "config" : "exchange",
    );
  }

  /*
   * Two ways in, decided in one place — see `features/members/service.ts`. A
   * hardcoded super admin needs no row; anybody else needs one that a super
   * admin created, and it has to be active. The row is also refreshed here,
   * which is why this is a write rather than a check.
   */
  let admission: Awaited<ReturnType<typeof admit>>;
  try {
    admission = await admit(profile);
  } catch (error) {
    // A malformed ADMIN_GITHUB_IDS throws out of the super-admin list, and the
    // person who can fix it is the one staring at this.
    console.error("[auth] could not decide whether to admit the account", error);
    return fail(request, "config");
  }

  if (!admission.ok) {
    console.warn(`[auth] rejected ${profile.login} (${profile.id}): ${admission.reason}`);
    return fail(request, admission.reason);
  }

  const { token } = await createSession(admission.user.id, {
    ip: clientIp(request),
    userAgent: userAgent(request),
  });

  const response = NextResponse.redirect(new URL(next, originOf(request)));
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  response.cookies.delete(STATE_COOKIE);
  return response;
}
