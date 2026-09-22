#!/usr/bin/env node
/**
 * Fixture tests for `check-architecture.mjs`.
 *
 * A check that only ever passes is indistinguishable from a check that does nothing, so
 * every rule is exercised twice: once on a tree that breaks it and once on the tree that
 * is supposed to be allowed. Fixtures are written into a temporary directory — the real
 * source tree is never touched, and `checkArchitecture()` takes its root as an argument
 * precisely so that it can be pointed at one.
 *
 * Node's own test runner, no dependency: `node --test scripts/check-architecture.test.mjs`.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { checkArchitecture, isClientFile, readImports } from "./check-architecture.mjs";

const roots = [];

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** Writes `files` (path relative to the fixture root -> contents) into a fresh temp tree. */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "arch-check-"));
  roots.push(root);
  for (const [path, contents] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
}

/** The violations alone; `checkArchitecture` also reports how many files it read. */
const check = (root) => checkArchitecture(root).violations;
const rulesOf = (violations) => violations.map((violation) => violation.rule).sort();
const CLIENT = '"use client";\n';

test("a client file may not import a feature barrel", () => {
  const root = fixture({
    "apps/demo/src/features/one/index.ts": "export const one = 1;\n",
    "apps/demo/src/features/two/index.ts": "export const two = 2;\n",
    "apps/demo/src/features/two/panel.tsx": `${CLIENT}import { one } from "@/features/one";\nexport const Panel = () => one;\n`,
  });

  const violations = check(root);
  assert.deepEqual(rulesOf(violations), ["client-door"]);
  assert.equal(violations[0].path, "apps/demo/src/features/two/panel.tsx");
  assert.equal(violations[0].line, 2);
  assert.match(violations[0].reason, /queries\.ts/);
});

test("a client file may not import a feature's server internals", () => {
  const root = fixture({
    "apps/demo/src/features/one/index.ts": "export const one = 1;\n",
    "apps/demo/src/features/one/queries.ts": "export const rows = [];\n",
    "apps/demo/src/features/two/index.ts": "export const two = 2;\n",
    "apps/demo/src/features/two/panel.tsx": `${CLIENT}import { rows } from "@/features/one/queries";\nexport const Panel = () => rows;\n`,
  });

  assert.deepEqual(rulesOf(check(root)), ["client-door"]);
});

test("a client file may open model, actions and components", () => {
  const root = fixture({
    "apps/demo/src/features/one/index.ts": "export const one = 1;\n",
    "apps/demo/src/features/one/model.ts": "export const name = 'one';\n",
    "apps/demo/src/features/one/actions.ts": '"use server";\nexport async function save() {}\n',
    "apps/demo/src/features/one/components/index.ts": "export const Widget = () => null;\n",
    "apps/demo/src/features/two/index.ts": "export const two = 2;\n",
    "apps/demo/src/features/two/panel.tsx": [
      CLIENT,
      'import { save } from "@/features/one/actions";\n',
      'import { Widget } from "@/features/one/components";\n',
      'import { name } from "@/features/one/model";\n',
      "export const Panel = () => [name, save, Widget];\n",
    ].join(""),
  });

  assert.deepEqual(check(root), []);
});

test("a server file may still import a feature barrel", () => {
  const root = fixture({
    "apps/demo/src/features/one/index.ts": "export const one = 1;\n",
    "apps/demo/src/features/two/index.ts": "export const two = 2;\n",
    "apps/demo/src/features/two/service.ts":
      'import { one } from "@/features/one";\nexport const use = one;\n',
  });

  assert.deepEqual(check(root), []);
});

test("a feature with a root file needs an index.ts front door", () => {
  const root = fixture({
    "apps/demo/src/features/one/model.ts": "export const one = 1;\n",
  });

  const violations = check(root);
  assert.deepEqual(rulesOf(violations), ["front-door"]);
  assert.equal(violations[0].path, "apps/demo/src/features/one/");
  assert.equal(violations[0].line, undefined);
});

test("a feature that is only a components/ folder needs no front door", () => {
  const root = fixture({
    "apps/demo/src/features/one/components/panel.tsx": "export const Panel = () => null;\n",
  });

  assert.deepEqual(check(root), []);
});

test("a non-route file may not name a component file directly", () => {
  const root = fixture({
    "apps/demo/src/features/one/index.ts": "export const one = 1;\n",
    "apps/demo/src/features/one/components/panel.tsx": "export const Panel = () => null;\n",
    "apps/demo/src/features/two/index.ts": "export const two = 2;\n",
    "apps/demo/src/features/two/host.tsx":
      'import { Panel } from "@/features/one/components/panel";\nexport const Host = () => Panel;\n',
  });

  const violations = check(root);
  assert.deepEqual(rulesOf(violations), ["route-reach"]);
  assert.equal(violations[0].line, 1);
});

test("a page and a layout may name a component file directly", () => {
  const root = fixture({
    "apps/demo/src/features/one/index.ts": "export const one = 1;\n",
    "apps/demo/src/features/one/components/page-body.tsx": "export const PageBody = () => null;\n",
    "apps/demo/src/features/one/components/shell.tsx": "export const Shell = () => null;\n",
    "apps/demo/src/app/(dashboard)/page.tsx":
      'export { PageBody as default } from "@/features/one/components/page-body";\n',
    "apps/demo/src/app/(dashboard)/layout.tsx":
      'export { Shell as default } from "@/features/one/components/shell";\n',
    "apps/demo/src/app/page.tsx":
      'export { PageBody as default } from "@/features/one/components/page-body";\n',
  });

  assert.deepEqual(check(root), []);
});

test("not even a route may reach inside a component file's folder", () => {
  const root = fixture({
    "apps/demo/src/features/one/index.ts": "export const one = 1;\n",
    "apps/demo/src/features/one/components/shell/inner.tsx": "export const Inner = () => null;\n",
    "apps/demo/src/app/page.tsx":
      'export { Inner as default } from "@/features/one/components/shell/inner";\n',
  });

  assert.deepEqual(rulesOf(check(root)), ["route-reach"]);
});

test("lib may not value-import a feature", () => {
  const root = fixture({
    "apps/demo/src/features/one/index.ts": "export const one = 1;\n",
    "apps/demo/src/lib/mailer.ts":
      'import { one } from "@/features/one";\nexport const send = () => one;\n',
  });

  const violations = check(root);
  assert.deepEqual(rulesOf(violations), ["lib-type-only"]);
  assert.equal(violations[0].path, "apps/demo/src/lib/mailer.ts");
});

test("lib may take a type from a feature, and site.ts may take the price", () => {
  const root = fixture({
    "apps/academy/src/features/orders/index.ts": "export type Order = { id: string };\n",
    "apps/academy/src/features/pricing/index.ts": "export const PRICING = { set: 1 };\n",
    "apps/academy/src/lib/orders/service.ts":
      'import type { Order } from "@/features/orders";\nexport const send = (order: Order) => order;\n',
    "apps/academy/src/lib/site.ts":
      'import { PRICING } from "@/features/pricing";\nexport const site = { price: PRICING.set };\n',
  });

  assert.deepEqual(check(root), []);
});

test("the site.ts exemption is that file and that feature, nothing else", () => {
  const root = fixture({
    "apps/academy/src/features/orders/index.ts": "export const ORDERS = 1;\n",
    "apps/academy/src/lib/site.ts":
      'import { ORDERS } from "@/features/orders";\nexport const site = { ORDERS };\n',
  });

  assert.deepEqual(rulesOf(check(root)), ["lib-type-only"]);
});

test("the flexiq exemption is named, scoped and load-bearing", () => {
  const files = (app) => ({
    [`apps/${app}/src/features/hero-fx/index.ts`]: "export const HeroField = () => null;\n",
    [`apps/${app}/src/features/home/posts.ts`]: "export const posts = [];\n",
    [`apps/${app}/src/features/home/hero.tsx`]: `${CLIENT}import { HeroField } from "@/features/hero-fx";\nexport const Hero = () => HeroField;\n`,
  });

  assert.deepEqual(check(fixture(files("flexiq"))), []);
  assert.deepEqual(rulesOf(check(fixture(files("demo")))), ["client-door", "front-door"]);
});

test("apps/<app>/scripts is outside the import graph and outside the check", () => {
  const root = fixture({
    "apps/demo/src/features/one/index.ts": "export const one = 1;\n",
    "apps/demo/src/features/one/queries.ts": "export const rows = [];\n",
    "apps/demo/scripts/verify.ts": `${CLIENT}import { rows } from "@/features/one/queries";\nexport const check = rows;\n`,
  });

  assert.deepEqual(check(root), []);
});

test('"use client" is read past comments and only at the top', () => {
  assert.equal(isClientFile('"use client";\n'), true);
  assert.equal(isClientFile("// a note\n/* and another */\n'use client';\n"), true);
  assert.equal(isClientFile('import x from "y";\n"use client";\n'), false);
  assert.equal(isClientFile('const s = "use client";\n'), false);
});

test("import scanning finds every shape and tracks type-only statements", () => {
  const imports = readImports(
    [
      'import type { A } from "@/features/one";',
      'import { b } from "@/features/two/model";',
      'export { c } from "@/features/three/actions";',
      'import "@/features/four/side-effect";',
      'const five = await import("@/features/five/model");',
      "import {",
      "  six,",
      '} from "@/features/six/model";',
    ].join("\n"),
  );

  assert.deepEqual(
    imports.map(({ line, specifier, typeOnly }) => [line, specifier, typeOnly]),
    [
      [1, "@/features/one", true],
      [2, "@/features/two/model", false],
      [3, "@/features/three/actions", false],
      [4, "@/features/four/side-effect", false],
      [5, "@/features/five/model", false],
      [8, "@/features/six/model", false],
    ],
  );
});
