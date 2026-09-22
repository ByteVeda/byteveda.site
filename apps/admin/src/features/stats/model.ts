/**
 * What a tracked package is, and what its numbers look like once read.
 *
 * The types the downloads page is described in, the registry naming hints, and
 * the rules that infer a package from the project catalogue. No value import of
 * `@byteveda/db` and no I/O, so the add-package form and the trend chart — both
 * of which run in the browser — can import this without dragging `pg` towards
 * the client bundle. The rows themselves are `queries.ts`.
 */

import type { Ecosystem } from "@byteveda/db";
import { type Project, projects } from "@byteveda/utils";

/** Two 30-day windows: one to show, one to compare against. */
export const WINDOW_DAYS = 30;

export type PackageStats = {
  packageId: string;
  ecosystem: Ecosystem;
  packageName: string;
  /**
   * One entry per day for the recent window, oldest first. `null` means no row
   * was ever recorded for that day — which is not the same as zero downloads,
   * and must not be drawn as a point on the baseline.
   */
  spark: (number | null)[];
  /** Days in the window that actually have a row. */
  recordedDays: number;
  last30: number;
  previous30: number;
  total: number | null;
  totalSource: string | null;
  status: "ok" | "failed" | "unsupported" | "never";
  detail: string | null;
  lastRunAt: Date | null;
};

export type ProjectStats = {
  slug: string;
  name: string;
  packages: PackageStats[];
  /** Sum across ecosystems, which is the number worth ranking projects by. */
  last30: number;
  previous30: number;
};

export type DailyTotal = { day: string; downloads: number | null };

/**
 * How each registry names a package, shown while adding one.
 *
 * Kept apart from the adapters so a client component can show the hint without
 * pulling collection code — and its credentials — into the browser bundle.
 */
export const adapterHints: Record<Ecosystem, string> = {
  pypi: "flexiq",
  npm: "@byteveda/flexiq",
  crates: "flexiq",
  maven: "org.byteveda.agenteval:agenteval-junit5",
};

export type PackageSuggestion = {
  projectSlug: string;
  ecosystem: Ecosystem;
  packageName: string;
};

/**
 * Where each catalogue project is published, read from its install line.
 *
 * Only `install` is used. It was tempting to also infer crates.io from a Rust
 * project and npm from a TypeScript one, but the language a project is written
 * in says nothing about where it is published — trying it against the real
 * catalogue produced four 404s out of six guesses. A package that exists and
 * is missing is one click to add; a package that does not exist sits on the
 * dashboard failing every night.
 */
export function suggestionsFor(project: Project): PackageSuggestion[] {
  const found: PackageSuggestion[] = [];
  const add = (ecosystem: Ecosystem, packageName: string) =>
    found.push({ projectSlug: project.slug, ecosystem, packageName });

  const pip = /^pip install\s+(\S+)/.exec(project.install);
  if (pip) {
    add("pypi", pip[1]);
    return found;
  }

  const npm = /^npm (?:i|install)\s+(\S+)/.exec(project.install);
  if (npm) {
    add("npm", npm[1]);
    return found;
  }

  const cargo = /^cargo add\s+(\S+)/.exec(project.install);
  if (cargo) {
    add("crates", cargo[1]);
    return found;
  }

  // A bare `groupId:artifactId` is a Maven coordinate, not a shell command.
  if (/^[a-z][\w.]*:[\w.-]+$/i.test(project.install)) add("maven", project.install);

  return found;
}

export function catalogueSuggestions(): PackageSuggestion[] {
  return projects.flatMap(suggestionsFor);
}
