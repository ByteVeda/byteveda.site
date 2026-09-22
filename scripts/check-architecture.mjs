#!/usr/bin/env node
/**
 * Architecture check — the layering rules Biome cannot express.
 *
 * `biome.json` already bans the deep import paths, because those rules key off the
 * *specifier* and the *path of the file doing the importing*, which is all
 * `noRestrictedImports` and `overrides[].includes` can see. The rules below key off file
 * *contents* (`"use client"`, `import type`), directory *shape* (does this feature have a
 * front door?), or a specifier Biome cannot resolve, so they need a reader.
 *
 *   client-door    A `"use client"` file may open only a feature's client-safe doors:
 *                  `@/features/<name>/model`, `/actions`, `/components`. The bare
 *                  barrel is a violation even though it looks harmless — `index.ts`
 *                  re-exports `queries.ts`, which drags `pg` into the browser bundle.
 *
 *   front-door     A `features/<name>/` directory holding anything at its root besides
 *                  `components/` must have an `index.ts`. A feature that is only a
 *                  `components/` folder has no server API to expose and correctly has
 *                  no barrel.
 *
 *   route-reach    A `page.tsx` or a `layout.tsx` anywhere under `app/` may name a
 *                  component file directly — `@/features/<name>/components/<file>` —
 *                  because a page or a layout is a server component, so it cannot sit
 *                  behind the client-safe `components/index.ts` and must not sit on the
 *                  root barrel. No other file may, and not even a route may reach deeper
 *                  than the component file itself.
 *
 *   lib-type-only  `lib/` is adapters to the world outside this process, so it sits
 *                  below `features/` and may not depend on one. A type-only import is
 *                  erased before bundling and leaves no runtime edge, which Biome
 *                  cannot see — `biome.json` exempts the two academy adapter files that
 *                  take `import type` from `@/features/orders`, and this is the rule
 *                  that holds them to types.
 *
 *   feature-doors  The relative half of the rule `biome.json` enforces on `@/features/…`.
 *                  `noRestrictedImports` matches the literal specifier, so
 *                  `../inbox/queries` from inside `features/posts/` walks through every
 *                  rule in the config untouched. Here a relative specifier is resolved
 *                  against the app's `src/` and rewritten to its `@/` form first, so it
 *                  is held to the same four doors.
 *
 * All of the rules see the resolved form, so a relative import is checked like any other.
 * One that stays inside its own feature — `./model`, `../queries` from that feature's
 * `components/` — is how a feature talks to itself and is left alone.
 *
 * Scope: every `.ts`/`.tsx` under `apps/<app>/src`. Deliberately NOT `apps/<app>/scripts`
 * — those live outside `src/`, outside the app's import graph and outside the bundle.
 * `apps/admin/scripts/{verify-access,verify-inbox,realtime-check}.ts` reach into feature
 * internals by relative path on purpose: they are one-shot `tsx` scripts that cannot load
 * `next/headers`, so they cannot go through the same doors a request does.
 *
 * Node built-ins only, no dependency. `scripts/check-architecture.test.mjs` exercises
 * every rule against temporary fixture trees; run it with `pnpm check:arch:test`.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** A feature's named doors. Server code also has the barrel; client code has only these. */
const DOORS = new Set(["model", "actions", "components"]);

const FEATURE_PREFIX = "@/features/";
const SOURCE_FILE = /\.tsx?$/;
const SKIPPED_DIRS = new Set(["node_modules", ".next", ".turbo", "dist"]);

/**
 * The opening line of a statement that can name a module: `import …`, `export {`,
 * `export *`, `export type {`. Deliberately not plain `export`, so `export const q = …`
 * and `export default function …` cannot open one. Deliberately not `import(` or
 * `import.meta` either — a dynamic import is matched on its own.
 */
const MODULE_STATEMENT = /^\s*(?:import[\s{*"']|export\s+type\s*[{*]|export\s*[{*])/;

/**
 * Named exemptions. Each one is a rule in its own right, not a hole: it says which app
 * is out of scope for which check, and why. An app absent from this list is governed.
 */
const EXEMPTIONS = [
  // apps/flexiq predates the features-over-lib vocabulary — issue #361 restructured
  // apps/admin and apps/academy only. flexiq has no model.ts/actions.ts and no
  // components/ barrels, so the client door and the front door have nothing to key off
  // there. Delete this entry the day flexiq adopts the vocabulary. Every other rule,
  // and every other app, is governed.
  { app: "flexiq", rules: new Set(["client-door", "front-door"]) },
];

/**
 * The one lawful `lib/` -> `features/` value import. Both files are pinned in place by
 * issue #361 and nothing behaviour-preserving removes the edge; the real fix is for the
 * site metadata to take the price as an argument rather than import the feature.
 */
const LIB_VALUE_IMPORT_EXEMPTION = {
  file: "apps/academy/src/lib/site.ts",
  specifier: "@/features/pricing",
};

function exempt(app, rule) {
  return EXEMPTIONS.some((entry) => entry.app === app && entry.rules.has(rule));
}

/** Every `.ts`/`.tsx` file under `dir`, depth first. */
function sourceFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIPPED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (SOURCE_FILE.test(entry.name)) found.push(full);
  }
  return found;
}

/**
 * True when the first non-comment statement of the file is the `"use client"` directive.
 * Skips leading whitespace, line comments and block comments, which is what "first
 * statement" means to the bundler too.
 */
export function isClientFile(source) {
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      i += 1;
    } else if (c === "/" && source[i + 1] === "/") {
      const end = source.indexOf("\n", i);
      if (end === -1) return false;
      i = end + 1;
    } else if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) return false;
      i = end + 2;
    } else {
      break;
    }
  }
  return /^(["'])use client\1/.test(source.slice(i));
}

/**
 * Strips comments from one line: a line comment runs to the end of the line, a block
 * comment carries across lines. Quote state is tracked, so a `//` inside a string is left
 * alone. Returns the stripped text and whether a block comment is still open after it.
 */
function stripComments(line, inBlock) {
  let out = "";
  let quote = null;
  let i = 0;

  while (i < line.length) {
    const two = line.slice(i, i + 2);

    if (inBlock) {
      if (two === "*/") {
        inBlock = false;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (quote) {
      out += line[i];
      if (line[i] === "\\") {
        out += line[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (line[i] === quote) quote = null;
      i += 1;
      continue;
    }

    if (line[i] === '"' || line[i] === "'" || line[i] === "`") {
      quote = line[i];
      out += line[i];
      i += 1;
      continue;
    }

    if (two === "//") return { text: out, inBlock: false };
    if (two === "/*") {
      inBlock = true;
      i += 2;
      continue;
    }

    out += line[i];
    i += 1;
  }

  return { text: out, inBlock };
}

/**
 * Every module specifier in the file, with the 1-based line it sits on and whether its
 * statement was type-only. A line scanner rather than an AST: the repo is Biome-formatted,
 * so an import is one statement per line group. Covers `import x from`, `export x from`,
 * bare `import "x"` and dynamic `import("x")`.
 *
 * Two things keep it from inventing imports. Comments are stripped first, so a
 * commented-out import is not an import. And a `from "…"` only counts while a *module*
 * statement is open — `import …`, `export {`, `export *`, `export type {` — so neither
 * `export const q = \`select * from "…"\`` nor a lingering `export type X = {` block can
 * produce a specifier or leak its `type` onto something further down the file.
 */
export function readImports(source) {
  const lines = source.split("\n");
  const found = [];
  let head = null;
  let inBlock = false;

  for (let i = 0; i < lines.length; i += 1) {
    const { text, inBlock: stillOpen } = stripComments(lines[i], inBlock);
    inBlock = stillOpen;

    // A dynamic import can sit anywhere, and is never type-only.
    const dynamic = text.match(/\bimport\(\s*["']([^"']+)["']\s*\)/);
    if (dynamic) found.push({ line: i + 1, specifier: dynamic[1], typeOnly: false });

    if (head === null) {
      if (!MODULE_STATEMENT.test(text)) continue;
      head = text;
    }

    const match =
      text.match(/\bfrom\s*["']([^"']+)["']/) ?? text.match(/^\s*import\s+["']([^"']+)["']/);

    if (match) {
      found.push({
        line: i + 1,
        specifier: match[1],
        typeOnly: /^\s*(?:import|export)\s+type\b/.test(head),
      });
      head = null;
      continue;
    }

    // A statement that ended without naming a module — `export { a };`, a type alias,
    // anything else that opens with one of those keywords — closes the head.
    if (/[;}]\s*$/.test(text)) head = null;
  }

  return found;
}

/** `@/features/inbox/components/x` -> `["inbox", "components", "x"]`; anything else -> null. */
function featurePath(specifier) {
  if (!specifier.startsWith(FEATURE_PREFIX)) return null;
  return specifier.slice(FEATURE_PREFIX.length).split("/").filter(Boolean);
}

function isRouteFile(relPath) {
  return /^apps\/[^/]+\/src\/app\/(?:.*\/)?(?:page|layout)\.tsx$/.test(relPath);
}

/** The feature a file lives in, or null if it lives outside `features/`. */
function featureOf(relPath) {
  const match = relPath.match(/^apps\/[^/]+\/src\/features\/([^/]+)\//);
  return match ? match[1] : null;
}

/**
 * The `@/`-aliased form of a specifier. Biome matches the literal string, so a relative
 * import is invisible to it — `../inbox/queries` from inside `features/posts/` walks
 * straight through every rule in `biome.json`. Resolving it here closes that, and is the
 * one part of these checks Biome structurally cannot do.
 *
 * Returns null when a relative import lands outside the app's `src/`, which is nothing
 * these rules have an opinion about.
 */
function toAlias(specifier, file, srcDir) {
  if (!specifier.startsWith(".")) return specifier;
  const inside = relative(srcDir, resolve(dirname(file), specifier))
    .split("\\")
    .join("/");
  if (inside === "" || inside === ".." || inside.startsWith("../")) return null;
  return `@/${inside}`;
}

/** Directory shape: does every feature that needs a front door have one? */
function checkFrontDoors(root, app, violations) {
  const featuresDir = join(root, "apps", app, "src", "features");
  if (!existsSync(featuresDir)) return;
  if (exempt(app, "front-door")) return;

  for (const entry of readdirSync(featuresDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(featuresDir, entry.name);
    const contents = readdirSync(dir, { withFileTypes: true });
    const beyondComponents = contents.filter(
      (item) => !(item.isDirectory() && item.name === "components"),
    );
    if (beyondComponents.length === 0) continue;
    if (contents.some((item) => item.isFile() && item.name === "index.ts")) continue;

    violations.push({
      path: `apps/${app}/src/features/${entry.name}/`,
      rule: "front-door",
      reason:
        "a feature with anything at its root besides components/ needs an index.ts front door — curated named re-exports of its server API",
    });
  }
}

/**
 * Walks `apps/<app>/src` under `root` and returns `{ files, violations }`. Each violation
 * carries the path, the 1-based line where there is one, the rule that caught it and a
 * one-line reason.
 */
export function checkArchitecture(root) {
  const violations = [];
  const appsDir = join(root, "apps");
  if (!existsSync(appsDir)) return { files: 0, violations };

  const apps = readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  let files = 0;

  for (const app of apps) {
    const srcDir = join(appsDir, app, "src");
    if (!existsSync(srcDir)) continue;

    checkFrontDoors(root, app, violations);

    for (const file of sourceFiles(srcDir).sort()) {
      files += 1;
      const relPath = relative(root, file).split("\\").join("/");
      const source = readFileSync(file, "utf8");
      const client = isClientFile(source);
      const route = isRouteFile(relPath);
      const inLib = relPath.startsWith(`apps/${app}/src/lib/`);
      const ownFeature = featureOf(relPath);
      const imports = readImports(source);

      for (const { line, specifier: written, typeOnly } of imports) {
        const specifier = toAlias(written, file, srcDir);
        if (specifier === null) continue;
        const segments = featurePath(specifier);

        // Relative imports inside a feature's own folder are how a feature talks to
        // itself — `./model`, `../queries` from its own components. Only the ones that
        // cross out of it are the rules' business.
        if (segments && written !== specifier && segments[0] === ownFeature) continue;

        // A relative import is reported as written and as resolved, so the line the
        // reader opens matches and the rule that fired still makes sense.
        const viaRelative = written !== specifier;
        const shown = viaRelative ? `${written}" -> "${specifier}` : specifier;

        // Biome owns the aliased form of this rule; only the relative form reaches here,
        // because `noRestrictedImports` matches the literal specifier and never sees it.
        // A reach into `components/` is left to route-reach, which knows about routes.
        if (
          segments &&
          viaRelative &&
          segments.length > 1 &&
          !(segments[1] === "components" && segments.length > 2) &&
          !(segments.length === 2 && DOORS.has(segments[1]))
        ) {
          violations.push({
            path: relPath,
            line,
            rule: "feature-doors",
            reason: `a relative import is still an import: "${shown}" reaches past another feature's doors — use its barrel "@/features/${segments[0]}", or /model, /actions, /components`,
          });
        }

        if (segments && client && !exempt(app, "client-door")) {
          if (segments.length === 1) {
            violations.push({
              path: relPath,
              line,
              rule: "client-door",
              reason: `a "use client" file may not import the feature barrel "${shown}" — it re-exports queries.ts, which drags the database driver into the browser bundle; use /model, /actions or /components`,
            });
          } else if (!(segments.length === 2 && DOORS.has(segments[1]))) {
            violations.push({
              path: relPath,
              line,
              rule: "client-door",
              reason: `a "use client" file may open only a feature's client-safe doors (model, actions, components); "${shown}" is not one`,
            });
          }
        }

        if (segments && segments[1] === "components" && segments.length > 2) {
          if (!route) {
            violations.push({
              path: relPath,
              line,
              rule: "route-reach",
              reason: `only app/**/page.tsx and app/**/layout.tsx may name a component file directly; reach this feature through "@/features/${segments[0]}/components"`,
            });
          } else if (segments.length > 3) {
            violations.push({
              path: relPath,
              line,
              rule: "route-reach",
              reason: `a route reaches its screen by that component's own path, "@/features/${segments[0]}/components/<file>" — not a path inside it`,
            });
          }
        }

        if (segments && inLib && !typeOnly) {
          const allowed =
            relPath === LIB_VALUE_IMPORT_EXEMPTION.file &&
            specifier === LIB_VALUE_IMPORT_EXEMPTION.specifier;
          if (!allowed) {
            violations.push({
              path: relPath,
              line,
              rule: "lib-type-only",
              reason: `lib/ is adapters only and sits below features/: it may not value-import "${shown}" (a type-only import is erased before bundling and is fine)`,
            });
          }
        }
      }
    }
  }

  return { files, violations };
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const { files, violations } = checkArchitecture(root);

  if (violations.length === 0) {
    console.log(`Architecture check: ${files} files, no violations.`);
    return 0;
  }

  for (const { path, line, rule, reason } of violations) {
    const where = line === undefined ? path : `${path}:${line}`;
    console.error(`${where}  [${rule}] ${reason}`);
  }
  console.error(`\nArchitecture check: ${violations.length} violation(s) in ${files} files.`);
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
