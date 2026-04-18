import { LABELS, type Label } from "@/lib/news";

const KEYWORDS: Record<Label, string[]> = {
  rust: ["rust", "rustlang", "rust-lang", "rustacean"],
  python: ["python", "python3", "py", "pypy", "cpython"],
  java: ["java", "jvm", "kotlin", "scala"],
  go: ["go", "golang", "go-lang"],
  typescript: ["typescript", "ts", "javascript", "js", "nodejs", "node"],
  ai: [
    "ai",
    "artificial",
    "artificialintelligence",
    "artificial-intelligence",
    "llm",
    "llms",
    "genai",
    "generativeai",
    "localllama",
  ],
  ml: [
    "ml",
    "machinelearning",
    "machine-learning",
    "deeplearning",
    "deep-learning",
    "neuralnetworks",
    "pytorch",
    "tensorflow",
  ],
  opensource: ["opensource", "open-source", "foss", "libre", "freesoftware"],
  performance: ["performance", "perf", "optimization", "optimisation", "highperformance"],
  devops: ["devops", "sre", "kubernetes", "k8s", "docker", "ci", "cd", "cicd", "infrastructure"],
  security: ["security", "infosec", "cybersecurity", "cve", "vulnerability", "appsec"],
  webdev: ["webdev", "web", "frontend", "backend", "fullstack", "react", "vue", "svelte", "nextjs"],
};

const LOOKUP: Map<string, Label> = (() => {
  const map = new Map<string, Label>();
  for (const label of LABELS) {
    map.set(label, label);
    for (const keyword of KEYWORDS[label]) map.set(keyword, label);
  }
  return map;
})();

function canonical(raw: string): Label | null {
  const key = raw
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .trim();
  if (LOOKUP.has(key)) return LOOKUP.get(key) ?? null;
  const compact = key.replace(/-/g, "");
  return LOOKUP.get(compact) ?? null;
}

const MAX_LABELS = 3;

export function toLabels(rawTags: readonly string[], hints: readonly Label[] = []): Label[] {
  const seen = new Set<Label>();
  for (const hint of hints) {
    if (seen.size >= MAX_LABELS) break;
    seen.add(hint);
  }
  for (const raw of rawTags) {
    if (seen.size >= MAX_LABELS) break;
    if (!raw) continue;
    const label = canonical(raw);
    if (label) seen.add(label);
  }
  return [...seen];
}

export type { Label };
