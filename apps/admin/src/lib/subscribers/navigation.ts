/**
 * Whether a request looks like a person clicking a link.
 *
 * Acting on GET means whatever fetches the URL performs the action, and mail
 * clients, security scanners, and link previewers all fetch URLs in messages.
 * Fetch metadata is what separates them: a real click is a top-level document
 * navigation, while a prefetch or a preview announces itself as something else.
 *
 * Deliberately permissive when the headers are absent — an old browser or a
 * privacy tool that strips them is a person, and refusing them would break a
 * working link to catch a scanner that could have set the headers anyway. This
 * stops the common accidental case, not a determined one.
 */
export type FetchMetadata = {
  mode: string | null;
  dest: string | null;
  purpose: string | null;
};

export function readFetchMetadata(headers: Headers): FetchMetadata {
  return {
    mode: headers.get("sec-fetch-mode"),
    dest: headers.get("sec-fetch-dest"),
    // Chrome sends `purpose`, Firefox `x-moz`, some proxies `x-purpose`.
    purpose: headers.get("purpose") ?? headers.get("x-purpose") ?? headers.get("x-moz") ?? null,
  };
}

export function isDirectNavigation(meta: FetchMetadata): boolean {
  if (meta.purpose?.toLowerCase() === "prefetch") return false;

  // Nothing to go on: treat as a person rather than break a real link.
  if (!meta.mode && !meta.dest) return true;

  if (meta.mode && meta.mode !== "navigate") return false;
  if (meta.dest && meta.dest !== "document") return false;

  return true;
}
