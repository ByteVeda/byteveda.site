import { adminUsers, getDb } from "@byteveda/db";
import { type NextRequest, NextResponse } from "next/server";
import { isAllowed } from "@/lib/auth/allowlist";
import { exchangeCode, fetchUser } from "@/lib/auth/github";
import {
  createSession,
  SESSION_COOKIE,
  STATE_COOKIE,
  safeEqual,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { callbackUrl, safeNext } from "@/lib/auth/urls";
import { clientIp, userAgent } from "@/lib/request";

export const dynamic = "force-dynamic";

/** Reason codes the login page knows how to explain. */
type Failure = "denied" | "state" | "exchange" | "config";

function fail(request: NextRequest, reason: Failure) {
  const url = new URL("/login", request.nextUrl.origin);
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

  try {
    if (!isAllowed(profile.id)) {
      console.warn(`[auth] rejected ${profile.login} (${profile.id}): not on the allowlist`);
      return fail(request, "denied");
    }
  } catch (error) {
    console.error("[auth] allowlist is not usable", error);
    return fail(request, "config");
  }

  const [user] = await getDb()
    .insert(adminUsers)
    .values({
      githubId: profile.id,
      login: profile.login,
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      lastLoginAt: new Date(),
    })
    .onConflictDoUpdate({
      target: adminUsers.githubId,
      set: {
        login: profile.login,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        lastLoginAt: new Date(),
      },
    })
    .returning();

  if (!user) return fail(request, "exchange");

  const { token } = await createSession(user.id, {
    ip: clientIp(request),
    userAgent: userAgent(request),
  });

  const response = NextResponse.redirect(new URL(next, request.nextUrl.origin));
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  response.cookies.delete(STATE_COOKIE);
  return response;
}
