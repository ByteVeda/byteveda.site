import { type NextRequest, NextResponse } from "next/server";
import {
  authoriseScope,
  checkAttachment,
  listStaged,
  maxFileBytes,
  parseScope,
  pruneStale,
  stage,
} from "@/features/attachments";
import { getSession } from "@/features/auth";

export const dynamic = "force-dynamic";

/**
 * Receives one file for a composer.
 *
 * A route handler rather than a server action, and one file per request rather
 * than the whole message, because of two limits that do not agree:
 *
 *  - a server action's request body is capped at 1MB by Next, and raising
 *    `serverActions.bodySizeLimit` raises it for *every* action in the console;
 *  - a serverless function's request body is capped at 4.5MB by the platform,
 *    whatever Next is configured to allow.
 *
 * Resend allows 40MB per email. The only way to reach it is to upload the files
 * one at a time, keep them, and assemble the message at the send — which is
 * what `features/attachments/store.ts` is for.
 *
 * Inside the cookie gate: the proxy has already bounced anonymous requests, and
 * this resolves the session properly and then asks whether the operator may
 * write in the composer they named.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    // What a body over the platform's limit looks like from in here, when it
    // gets in here at all.
    return NextResponse.json(
      { ok: false, message: "That upload did not arrive in one piece. Try a smaller file." },
      { status: 400 },
    );
  }

  const scope = parseScope(String(form.get("scope") ?? ""), String(form.get("for") ?? ""));
  if (!scope) {
    return NextResponse.json({ ok: false, message: "Nothing to attach it to." }, { status: 400 });
  }

  const allowed = await authoriseScope(scope, session.access);
  if (!allowed.ok) {
    return NextResponse.json({ ok: false, message: allowed.message }, { status: allowed.status });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "No file was sent." }, { status: 400 });
  }

  // Checked against what is already staged, not against the file on its own:
  // Resend's 40MB is a budget for the whole message, and the browser's copy of
  // this check can be out of date by the time the bytes arrive.
  const staged = await listStaged(scope);
  const verdict = checkAttachment(
    { filename: file.name, byteSize: file.size },
    staged,
    0,
    maxFileBytes(),
  );
  if (!verdict.ok) {
    return NextResponse.json({ ok: false, message: verdict.message }, { status: 413 });
  }

  const content = Buffer.from(await file.arrayBuffer());

  // `file.size` is what the browser claimed; this is what arrived. They differ
  // on a truncated upload, and storing the shorter one would send a broken PDF.
  if (content.byteLength !== file.size || content.byteLength > maxFileBytes()) {
    return NextResponse.json(
      { ok: false, message: `${file.name} did not upload completely. Try again.` },
      { status: 400 },
    );
  }

  const stored = await stage({
    scope,
    filename: file.name,
    contentType: file.type,
    content,
    uploadedBy: session.user.id,
  });

  // Sweeps uploads nobody ever sent, on the way past. See `pruneStale`.
  pruneStale().catch((error) => {
    console.error("[attachments] could not prune stale uploads", error);
  });

  return NextResponse.json({ ok: true, file: stored });
}
