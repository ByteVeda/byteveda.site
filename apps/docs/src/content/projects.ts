// Shim: the synced footer.tsx imports `projects` from "@/content/projects".
// This repo's source of truth is tools.ts. We remap each tool's `repoUrl` to
// the docs subpath (/<slug>/) so the footer's "Projects" column points visitors
// at the per-tool docs on this domain instead of at GitHub.
import { tools } from "./tools";

export const projects = tools.map((tool) => ({
  ...tool,
  repoUrl: `/${tool.slug}/`,
  docsUrl: undefined as string | undefined,
}));

export type Project = (typeof projects)[number];
