import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/features/auth";
import { authoriseDownload } from "@/lib/attachments/access";
import { describe, load } from "@/lib/attachments/store";

export const dynamic = "force-dynamic";

/**
 * Hands back a stored attachment.
 *
 * Two reads, deliberately: the metadata decides whether this operator may have
 * the file, and only then are the bytes fetched. Authorising after loading
 * would mean pulling 4MB out of Postgres to decide not to send it.
 *
 * The permission is the message's, not the file's — see
 * `lib/attachments/access.ts`. A conversation in a workspace this operator
 * cannot read answers 404, the same as an id that was never issued.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const file = await describe(id);
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });

  const allowed = await authoriseDownload(file, session.access);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.message }, { status: allowed.status });
  }

  const loaded = await load(id);
  if (!loaded) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(loaded.content), {
    headers: {
      "content-type": loaded.contentType,
      "content-length": String(loaded.content.byteLength),
      // `attachment`, always. Serving operator-uploaded bytes inline would let
      // an uploaded HTML file run as a page on the console's own origin.
      "content-disposition": `attachment; filename="${loaded.filename}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
