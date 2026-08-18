import { DOCS_URL, GITHUB_URL } from "./org";

export type Language = "Rust" | "Python" | "Java" | "TypeScript";
export type License = "MIT" | "Apache-2.0";

export type Project = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  languages: Language[];
  license: License;
  install: string;
  /** `github.com/ByteVeda/<slug>` */
  repoUrl: string;
  /** `docs.byteveda.org/<slug>` */
  docsUrl: string;
  /** `github.com/ByteVeda/<slug>#readme` */
  readmeUrl: string;
  /** Repo is archived upstream: no new releases, docs frozen at the last build. */
  archived?: boolean;
};

/** Everything about a project except the URLs, which are derived from `slug`. */
type ProjectSeed = Omit<Project, "repoUrl" | "docsUrl" | "readmeUrl">;

const seeds: ProjectSeed[] = [
  {
    slug: "flexiq",
    name: "FlexiQ",
    tagline: "Rust-powered task queue with native SDKs — no broker required.",
    description:
      "Priority queues, cron, retries, dead-letter, and a built-in dashboard, driven from Python, Node, or Java. Embedded SQLite by default, Postgres or Redis when you need to scale out.",
    languages: ["Rust", "Python", "TypeScript", "Java"],
    license: "MIT",
    install: "pip install flexiq",
  },
  {
    slug: "paperjam",
    name: "paperjam",
    tagline: "One Rust engine for PDF, DOCX, XLSX, PPTX, HTML, and EPUB.",
    description:
      "Extract text and tables, convert between formats, split and merge PDFs, sign and encrypt — all through a single async API, with a CLI and MCP server.",
    languages: ["Rust", "Python"],
    license: "MIT",
    install: "pip install paperjam",
    archived: true,
  },
  {
    slug: "agenteval",
    name: "agenteval",
    tagline: "JUnit 5-native evaluation for Java AI agents.",
    description:
      "23 built-in metrics, multi-model LLM-as-judge, red teaming, and regression tracking — all as a library you drop into your existing test suite.",
    languages: ["Java"],
    license: "Apache-2.0",
    install: "org.byteveda.agenteval:agenteval-junit5",
  },
  {
    slug: "reclink",
    name: "reclink",
    tagline: "High-performance fuzzy matching and record linkage.",
    description:
      "21 similarity metrics, 10 phonetic algorithms, and a full blocking → compare → classify → cluster pipeline. 5× faster than thefuzz in batch mode.",
    languages: ["Rust", "Python"],
    license: "Apache-2.0",
    install: "pip install reclink",
  },
  {
    slug: "dagron",
    name: "dagron",
    tagline: "Rust-backed DAG execution engine for Python.",
    description:
      "Build, execute, and analyze dependency graphs with thread-pool or async runners, incremental re-execution, content-addressable caching, and critical-path scheduling.",
    languages: ["Rust", "Python"],
    license: "MIT",
    install: "pip install dagron",
  },
];

export const projects: Project[] = seeds.map((seed) => ({
  ...seed,
  repoUrl: `${GITHUB_URL}/${seed.slug}`,
  docsUrl: `${DOCS_URL}/${seed.slug}`,
  readmeUrl: `${GITHUB_URL}/${seed.slug}#readme`,
}));
