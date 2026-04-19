export const site = {
  name: "ByteVeda",
  domain: "byteveda.org",
  url: "https://byteveda.org",
  tagline: "Fast tools for high-performance systems.",
  description:
    "ByteVeda builds libraries with Rust cores and ergonomic bindings for Python, Java, and beyond — performance-first tools for serious systems.",
  org: "ByteVeda",
  githubUrl: "https://github.com/ByteVeda",
  docsUrl: "https://docs.byteveda.org",
} as const;

export const nav = [
  { label: "About", href: "/#about" },
  { label: "Contribute", href: "/contribute" },
  { label: "News", href: "/news" },
  { label: "Docs", href: site.docsUrl },
  { label: "GitHub", href: site.githubUrl, external: true },
] as const;
