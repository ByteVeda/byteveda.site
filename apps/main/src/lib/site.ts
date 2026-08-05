import { DOCS_URL, GITHUB_URL, MAIN_DOMAIN, MAIN_URL, ORG } from "@byteveda/utils";

export const site = {
  name: ORG,
  domain: MAIN_DOMAIN,
  url: MAIN_URL,
  tagline: "Fast tools for high-performance systems.",
  description:
    "ByteVeda builds libraries with Rust cores and ergonomic bindings for Python, Java, and beyond — performance-first tools for serious systems.",
  org: ORG,
  githubUrl: GITHUB_URL,
  docsUrl: DOCS_URL,
} as const;

export const nav = [
  { label: "About", href: "/#about" },
  { label: "News", href: "/news" },
  { label: "Docs", href: site.docsUrl, external: true },
] as const;
