import { DOCS_URL, GITHUB_URL, MAIN_URL, ORG } from "@byteveda/utils";

const DOMAIN = "flexiq.byteveda.org";

export const site = {
  name: "FlexiQ",
  domain: DOMAIN,
  url: `https://${DOMAIN}`,
  tagline: "Background jobs without a broker",
  description:
    "A Rust-powered task queue with native Python, Node and Java SDKs. No message broker — the queue, results and schedules live in one SQLite file, and scale to Postgres or Redis when you need them to.",
  org: ORG,
  orgUrl: MAIN_URL,
  repoUrl: `${GITHUB_URL}/flexiq`,
  docsUrl: `${DOCS_URL}/flexiq`,
} as const;

export const nav = [
  { label: "Playground", href: "/playground" },
  { label: "Blog", href: "/blog" },
  { label: "Docs", href: site.docsUrl },
] as const;
