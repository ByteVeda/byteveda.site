export const site = {
  name: "ByteVeda",
  section: "docs",
  domain: "docs.byteveda.org",
  url: "https://docs.byteveda.org",
  homeUrl: "https://byteveda.org",
  tagline: "Everything ByteVeda, documented in one place.",
  description:
    "Documentation portal for ByteVeda's open-source libraries. Guides, API references, and examples for taskito, paperjam, agenteval, reclink, and dagron.",
  org: "ByteVeda",
  githubUrl: "https://github.com/ByteVeda",
  docsUrl: "https://docs.byteveda.org",
} as const;

export const nav = [
  { label: "Tools", href: "#tools" },
  { label: "Home", href: site.homeUrl, external: true },
  { label: "GitHub", href: site.githubUrl, external: true },
] as const;
