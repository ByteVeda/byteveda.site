#!/usr/bin/env node
/**
 * Architecture check — the layering rules Biome cannot express.
 *
 * `biome.json` already bans the deep import paths, because those rules key off the
 * *specifier* and the *path of the file doing the importing*, which is all
 * `noRestrictedImports` and `overrides[].includes` can see. The four rules below key
 * off file *contents* (`"use client"`, `import type`) or directory *shape* (does this
 * feature have a front door?), so they need a reader.
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
 *                  because a page or
 *                  a layout is a server component and so cannot sit behind the
 *                  client-safe `components/index.ts`, and must not sit on the root
 *                  barrel. No other file may, and not even a route may reach deeper
 *                  than the component file itself.
 *
 *   lib-type-only  `lib/` is adapters to the world outside this process, so it sits
 *                  below `features/` and may not depend on one. A type-only import is
 *                  erased before bundling and leaves no runtime edge, which Biome
 *                  cannot see — `biome.json` exempts the two academy adapter files that
 *                  take `import type` from `@/features/orders`, and this is the rule
 *                  that holds them to types.
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

/** The doors a `"use client"` file may open into another feature. */
const CLIENT_DOORS = new Set(["model", "actions", "components"]);

const FEATURE_PREFIX = "@/features/";
const SOURCE_FILE = /\.tsx?$/;
const SKIPPED_DIRS = new Set(["node_modules", ".next", ".turbo", "dist"]);

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
 * Every module specifier in the file, with the 1-based line it sits on and whether its
 * statement was type-only. A line scanner rather than an AST: imports are one statement
 * per line group and Biome formats them, so the statement head is the nearest preceding
 * `import`/`export` line. Covers `import x from`, `export x from`, bare `import "x"`
 * and dynamic `import("x")`.
 */
export function readImports(source) {
  const lines = source.split("\n");
  const found = [];
  let head = "";

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(?:import|export)\b/.test(line)) head = line;

    const match =
      line.match(/\bfrom\s*["']([^"']+)["']/) ??
      line.match(/^\s*import\s+["']([^"']+)["']/) ??
      line.match(/\bimport\(\s*["']([^"']+)["']\s*\)/);
    if (!match) continue;

    found.push({
      line: i + 1,
      specifier: match[1],
      typeOnly: /^\s*(?:import|export)\s+type\b/.test(head),
    });
    head = "";
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
      const imports = readImports(source);

      for (const { line, specifier, typeOnly } of imports) {
        const segments = featurePath(specifier);

        if (segments && client && !exempt(app, "client-door")) {
          if (segments.length === 1) {
            violations.push({
              path: relPath,
              line,
              rule: "client-door",
              reason: `a "use client" file may not import the feature barrel "${specifier}" — it re-exports queries.ts, which drags the database driver into the browser bundle; use /model, /actions or /components`,
            });
          } else if (!(segments.length === 2 && CLIENT_DOORS.has(segments[1]))) {
            violations.push({
              path: relPath,
              line,
              rule: "client-door",
              reason: `a "use client" file may open only a feature's client-safe doors (model, actions, components); "${specifier}" is not one`,
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
              reason: `lib/ is adapters only and sits below features/: it may not value-import "${specifier}" (a type-only import is erased before bundling and is fine)`,
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
