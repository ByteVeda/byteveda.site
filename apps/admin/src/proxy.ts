import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * A cheap gate, not the authorisation check.
 *
 * The proxy cannot reach Postgres, so it only asks whether a session cookie is
 * present — enough to bounce an anonymous visitor without rendering anything.
 * Whether that cookie names a live session is decided by `requireSession()` in
 * the dashboard layout, which is what actually protects the data.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const login = new URL("/login", request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *  - /login and the auth handshake, which anonymous visitors must reach
     *  - /api/webhooks, authenticated by signature rather than by cookie
     *  - /api/cron, authenticated by a shared secret
     *  - Next's own assets and the favicon
     */
    "/((?!login|api/auth|api/webhooks|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
