import { highlight, type Lang } from "@/lib/highlight";

/**
 * Highlighting produces a small, fixed set of `<span class="tok-*">` wrappers
 * from source the app itself generates — never from user input — so injecting
 * it as HTML is the whole point rather than a shortcut.
 */
export function Code({ code, lang }: { code: string; lang: Lang }) {
  return (
    <pre>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: tokens are generated from our own source strings */}
      <code dangerouslySetInnerHTML={{ __html: highlight(code, lang) }} />
    </pre>
  );
}
