import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Only the tags this site actually uses; anything else is ignored. */
const ALLOWED = /^blog(:[a-z0-9]+(-[a-z0-9]+)*)?$/;

function authorised(request: NextRequest): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * Called by the admin app when a post is published, edited, or removed.
 *
 * Blog reads are cached under `blog` and `blog:<slug>` tags, so clearing those
 * is the whole mechanism: the next request rebuilds the page from Postgres and
 * everything else stays cached.
 */
export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    // Deliberately terse. An unauthenticated caller learns nothing about
    // whether the secret is unset or merely wrong.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let tags: unknown;
  try {
    ({ tags } = (await request.json()) as { tags?: unknown });
  } catch {
    return NextResponse.json({ error: "expected a json body" }, { status: 400 });
  }

  if (!Array.isArray(tags) || tags.length === 0) {
    return NextResponse.json({ error: "expected a non-empty tags array" }, { status: 400 });
  }

  const accepted = tags.filter(
    (tag): tag is string => typeof tag === "string" && ALLOWED.test(tag),
  );

  // `expire: 0` because a publish should be visible on the next request, not
  // after a stale window. `updateTag` would be the alternative, but it is only
  // callable from a server action.
  for (const tag of accepted) revalidateTag(tag, { expire: 0 });

  return NextResponse.json({ revalidated: accepted });
}
