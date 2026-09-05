/**
 * A small regex highlighter, mirroring the one the docs site uses.
 *
 * Shiki would be prettier, but the playground generates its snippets in the
 * browser as the visitor moves a slider — a build-time highlighter cannot reach
 * that, and running two highlighters would let the home page and the playground
 * drift apart. One cheap tokenizer, used everywhere.
 */

export type Lang = "python" | "ts" | "java" | "rust";

const KEYWORDS: Record<Lang, string[]> = {
  python: [
    "from",
    "import",
    "def",
    "class",
    "return",
    "if",
    "elif",
    "else",
    "for",
    "while",
    "try",
    "except",
    "finally",
    "raise",
    "with",
    "as",
    "async",
    "await",
    "lambda",
    "yield",
    "pass",
    "None",
    "True",
    "False",
    "and",
    "or",
    "not",
    "in",
    "is",
    "print",
  ],
  ts: [
    "import",
    "from",
    "export",
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "try",
    "catch",
    "finally",
    "throw",
    "new",
    "await",
    "async",
    "class",
    "extends",
    "interface",
    "type",
    "number",
    "string",
    "boolean",
    "void",
    "null",
    "undefined",
    "true",
    "false",
    "console",
  ],
  java: [
    "import",
    "package",
    "public",
    "private",
    "protected",
    "static",
    "final",
    "class",
    "interface",
    "enum",
    "extends",
    "implements",
    "return",
    "if",
    "else",
    "for",
    "while",
    "try",
    "catch",
    "finally",
    "throw",
    "throws",
    "new",
    "void",
    "int",
    "long",
    "double",
    "boolean",
    "var",
    "String",
    "null",
    "true",
    "false",
  ],
  // Enough of Rust to render the core snippets the home page quotes verbatim.
  rust: [
    "pub",
    "fn",
    "let",
    "mut",
    "ref",
    "const",
    "static",
    "struct",
    "enum",
    "impl",
    "trait",
    "for",
    "in",
    "if",
    "else",
    "match",
    "return",
    "self",
    "Self",
    "use",
    "crate",
    "mod",
    "where",
    "as",
    "move",
    "async",
    "await",
    "dyn",
    "Some",
    "None",
    "Ok",
    "Err",
    "i32",
    "i64",
    "u64",
    "usize",
    "bool",
    "true",
    "false",
  ],
};

const escapeHtml = (code: string) =>
  code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function highlight(code: string, lang: Lang): string {
  const keywords = KEYWORDS[lang].join("|");
  const comment = lang === "python" ? "#[^\\n]*" : "//[^\\n]*";
  const pattern = new RegExp(
    [
      `(${comment})`,
      '("""[\\s\\S]*?"""|"[^"\\n]*"|\'[^\'\\n]*\'|`[^`]*`)',
      "(@[A-Za-z_][\\w.]*)",
      `\\b(${keywords})\\b`,
      "\\b(\\d[\\d_]*\\.?\\d*)\\b",
      "\\b([A-Za-z_]\\w*)(?=\\()",
    ].join("|"),
    "g",
  );

  return escapeHtml(code).replace(pattern, (match, com, str, dec, kw, num, fn) => {
    if (com) return `<span class="tok-com">${match}</span>`;
    if (str) return `<span class="tok-str">${match}</span>`;
    if (dec) return `<span class="tok-dec">${match}</span>`;
    if (kw) return `<span class="tok-kw">${match}</span>`;
    if (num) return `<span class="tok-num">${match}</span>`;
    if (fn) return `<span class="tok-fn">${match}</span>`;
    return match;
  });
}

export const LANG_FOR_SDK = { python: "python", node: "ts", java: "java" } as const;
