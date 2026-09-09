import type { Ecosystem } from "@byteveda/db";
import { type Project, projects } from "@byteveda/utils";

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
