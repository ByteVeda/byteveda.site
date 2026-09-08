import { marked } from "marked";
import TurndownService from "turndown";

/**
 * The bridge between the two editors.
 *
 * `body_mdx` is what the public site renders, so rich text has to come back out
 * as Markdown on every save. The conversion runs in the browser, where the
 * editor already holds the document — no server round trip, and no Markdown
 * dependency in a server bundle.
 */
function turndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
  });

  // Turndown has no strikethrough rule of its own, and StarterKit can produce it.
  service.addRule("strikethrough", {
    filter: ["del", "s"],
    replacement: (content) => `~~${content}~~`,
  });

  // Keep the language on a fenced block: Tiptap writes it as `language-*`.
  service.addRule("fencedCodeWithLanguage", {
    filter: (node) => node.nodeName === "PRE" && node.firstChild?.nodeName === "CODE",
    replacement: (_content, node) => {
      const code = (node as HTMLElement).firstChild as HTMLElement;
      const language = /language-(\S+)/.exec(code.className ?? "")?.[1] ?? "";
      return `\n\n\`\`\`${language}\n${code.textContent ?? ""}\n\`\`\`\n\n`;
    },
  });

  return service;
}

export function htmlToMarkdown(html: string): string {
  return turndown().turndown(html).trim();
}

export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { gfm: true, breaks: false, async: false });
}

/**
 * Whether the source uses anything Markdown alone cannot express.
 *
 * A capitalised tag is an MDX component, and `import`/`export` are MDX module
 * syntax. Converting either into rich text would silently drop it, so the
 * editor refuses the switch instead.
 */
export function containsJsx(source: string): boolean {
  const withoutCode = source.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  return (
    /<[A-Z][A-Za-z0-9]*[\s/>]/.test(withoutCode) ||
    /^\s*(import|export)\s+/m.test(withoutCode) ||
    // A brace expression at the start of a line is an MDX value, not prose.
    /^\s*\{[^}]*\}\s*$/m.test(withoutCode)
  );
}
