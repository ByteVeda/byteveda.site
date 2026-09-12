import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { subscribersChanged } from "@/lib/realtime";
import { eventStream } from "@/lib/realtime/stream";

export const dynamic = "force-dynamic";
/** Held open until the operator leaves the page or the platform cuts it. */
export const maxDuration = 300;

/**
 * Pushes subscriber-list changes to an open Subscribers page.
 *
 * A confirmation happens in the subscriber's browser, so the operator's page
 * has no other way to hear about it. The endpoint that performs the change
 * announces it on the bus; this forwards that to the browser.
 *
 * Authenticated by the session cookie, same as every other page — the proxy
 * checks a cookie exists, and this checks it names a live session.
 */
export async function GET(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return eventStream(request, (stream) => {
    // Lets the client tell a live stream from a silent one.
    stream.send("ready");

    return subscribersChanged.subscribe(() => stream.send("change"));
  });
}
