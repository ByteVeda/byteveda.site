import { projects } from "@/content/projects";
import type { Label } from "@/lib/news";
import { site } from "@/lib/site";

type RssFeed = { name: string; url: string; labels?: Label[] };

export const config = {
  org: site.org,
  userAgent: `ByteVedaNewsBot/1.0 (+${site.url})`,
  mentionTerms: [
    site.name.toLowerCase(),
    site.domain.toLowerCase(),
    ...projects.map((p) => p.name.toLowerCase()),
  ],
  devto: {
    tags: ["rust", "opensource", "python", "java", "performance", "ai", "machinelearning", "llm"],
    minReactions: 25,
    perTagLimit: 15,
  },
  hn: {
    queries: [
      site.name,
      site.domain,
      ...projects.map((p) => `${p.name} ${p.languages[0]?.toLowerCase() ?? ""}`.trim()),
    ],
    minPoints: 50,
    perQueryLimit: 10,
  },
  reddit: {
    subreddits: [
      { name: "rust", labels: ["rust"] },
      { name: "python", labels: ["python"] },
      { name: "java", labels: ["java"] },
      { name: "opensource", labels: ["opensource"] },
      { name: "programming", labels: [] },
      { name: "MachineLearning", labels: ["ml"] },
      { name: "LocalLLaMA", labels: ["ai", "ml"] },
      { name: "artificial", labels: ["ai"] },
    ] as const satisfies readonly { name: string; labels: readonly Label[] }[],
    window: "week",
    minScore: 150,
    perSubLimit: 12,
  },
  lobsters: {
    tags: ["rust", "python", "performance", "programming", "practices", "ai"],
    minScore: 15,
    perTagLimit: 15,
  },
  hashnode: {
    tagSlugs: ["rust", "python", "opensource", "performance", "devops", "ai", "machine-learning"],
    minReactions: 1,
    perTagLimit: 8,
  },
  mastodon: {
    instance: "fosstodon.org",
    tags: ["rust", "python", "opensource", "golang", "linux", "ai", "llm", "machinelearning"],
    perTagLimit: 10,
    minInteractions: 5,
  },
  rss: {
    feeds: [
      { name: "The Rust Blog", url: "https://blog.rust-lang.org/feed.xml", labels: ["rust"] },
      {
        name: "Python Insider",
        url: "https://blog.python.org/feeds/posts/default",
        labels: ["python"],
      },
      { name: "Stack Overflow Blog", url: "https://stackoverflow.blog/feed/" },
      { name: "GitHub Blog", url: "https://github.blog/feed/" },
      { name: "Mozilla Hacks", url: "https://hacks.mozilla.org/feed/" },
      { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", labels: ["ai", "ml"] },
    ] as const satisfies readonly RssFeed[],
    perFeedLimit: 5,
  },
  github: {
    org: site.org,
    releasesPerRepo: 3,
    reposLimit: 20,
  },
  trending: {
    languages: ["rust", "python", "java"],
    minStars: 100,
    withinDays: 7,
    perLanguageLimit: 8,
  },
  output: {
    maxItems: 80,
    maxItemsPerKind: {
      article: 30,
      release: 20,
      trending: 18,
    },
  },
} as const;
