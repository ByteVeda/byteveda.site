import { DOCS_DOMAIN, DOCS_URL, GITHUB_URL, MAIN_URL, ORG } from "@byteveda/utils";

export const site = {
  name: ORG,
  section: "docs",
  domain: DOCS_DOMAIN,
  url: DOCS_URL,
  homeUrl: MAIN_URL,
  tagline: "Everything ByteVeda, documented in one place.",
  description:
    "Documentation portal for ByteVeda's open-source libraries. Guides, API references, and examples for taskito, paperjam, agenteval, reclink, and dagron.",
  org: ORG,
  githubUrl: GITHUB_URL,
  docsUrl: DOCS_URL,
} as const;

export const nav = [
  { label: "Tools", href: "#tools" },
  { label: "Home", href: site.homeUrl },
  { label: "GitHub", href: site.githubUrl, external: true },
] as const;
