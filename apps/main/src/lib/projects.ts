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
  repoUrl: string;
  docsUrl?: string;
};

export const projects: Project[] = [
  {
    slug: "taskito",
    name: "taskito",
    tagline: "Rust-powered task queue for Python — no broker required.",
    description:
      "Priority queues, cron, retries, dead-letter, and a built-in dashboard. Embedded SQLite by default, Postgres when you need to scale out.",
    languages: ["Rust", "Python"],
    license: "MIT",
    install: "pip install taskito",
    repoUrl: "https://github.com/ByteVeda/taskito",
    docsUrl: "https://docs.byteveda.org/taskito",
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
    repoUrl: "https://github.com/ByteVeda/paperjam",
    docsUrl: "https://docs.byteveda.org/paperjam",
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
    repoUrl: "https://github.com/ByteVeda/agenteval",
    docsUrl: "https://docs.byteveda.org/agenteval",
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
    repoUrl: "https://github.com/ByteVeda/reclink",
    docsUrl: "https://docs.byteveda.org/reclink",
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
    repoUrl: "https://github.com/ByteVeda/dagron",
    docsUrl: "https://docs.byteveda.org/dagron",
  },
];
