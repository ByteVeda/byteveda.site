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
    "apps/academy/src/lib/mailer.ts":
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

test("no app is exempt from the client door or the front door", () => {
  const files = (app) => ({
    [`apps/${app}/src/features/hero-fx/index.ts`]: "export const HeroField = () => null;\n",
    [`apps/${app}/src/features/home/posts.ts`]: "export const posts = [];\n",
    [`apps/${app}/src/features/home/hero.tsx`]: `${CLIENT}import { HeroField } from "@/features/hero-fx";\nexport const Hero = () => HeroField;\n`,
  });

  // flexiq was the one app these two rules ever spared; it is on the doors now, and the
  // same tree is caught under its name exactly as it is under any other.
  assert.deepEqual(rulesOf(check(fixture(files("flexiq")))), ["client-door", "front-door"]);
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

test("a commented-out import is not an import", () => {
  const imports = readImports(
    [
      '// import { a } from "@/features/one/queries";',
      "/*",
      ' import { b } from "@/features/two/queries";',
      "*/",
      'import { c } from "@/features/three/model"; // keep this one',
      'const url = "https://example.com"; // not a comment inside the string',
    ].join("\n"),
  );

  assert.deepEqual(
    imports.map(({ line, specifier }) => [line, specifier]),
    [[5, "@/features/three/model"]],
  );
});

test("a string that reads like an import is not an import", () => {
  const imports = readImports(
    [
      'export const query = `select * from "@/features/orders"`;',
      'const msg = `select * from "@/features/pricing"`;',
    ].join("\n"),
  );

  assert.deepEqual(imports, []);
});

test("a type alias cannot leak its type onto a later dynamic import", () => {
  const imports = readImports(
    [
      "export type Config = {",
      "  a: string;",
      "};",
      "",
      'const loader = () => import("@/features/orders");',
    ].join("\n"),
  );

  assert.deepEqual(
    imports.map(({ line, specifier, typeOnly }) => [line, specifier, typeOnly]),
    [[5, "@/features/orders", false]],
  );
});

test("a commented-out import in a client file raises no violation", () => {
  const root = fixture({
    "apps/demo/src/features/one/index.ts": "export const one = 1;\n",
    "apps/demo/src/features/one/queries.ts": "export const rows = [];\n",
    "apps/demo/src/features/two/index.ts": "export const two = 2;\n",
    "apps/demo/src/features/two/panel.tsx": `${CLIENT}// import { rows } from "@/features/one/queries";\nexport const Panel = () => null;\n`,
  });

  assert.deepEqual(check(root), []);
});

test("a relative import out of a feature is resolved and caught", () => {
  const root = fixture({
    "apps/demo/src/features/inbox/index.ts": "export const inbox = 1;\n",
    "apps/demo/src/features/inbox/queries.ts": "export const rows = [];\n",
    "apps/demo/src/features/posts/index.ts": "export const posts = 1;\n",
    "apps/demo/src/features/posts/service.ts":
      'import { rows } from "../inbox/queries";\nexport const use = rows;\n',
  });

  const violations = check(root);
  assert.deepEqual(rulesOf(violations), ["feature-doors"]);
  assert.match(violations[0].reason, /\.\.\/inbox\/queries" -> "@\/features\/inbox\/queries/);
});

test("a relative import of another feature's door is fine", () => {
  const root = fixture({
    "apps/demo/src/features/inbox/index.ts": "export const inbox = 1;\n",
    "apps/demo/src/features/inbox/model.ts": "export const name = 'inbox';\n",
    "apps/demo/src/features/posts/index.ts": "export const posts = 1;\n",
    "apps/demo/src/features/posts/service.ts":
      'import { name } from "../inbox/model";\nimport { inbox } from "../inbox";\nexport const use = [name, inbox];\n',
  });

  assert.deepEqual(check(root), []);
});

test("a relative reach into another feature's components is a route question", () => {
  const files = {
    "apps/demo/src/features/inbox/index.ts": "export const inbox = 1;\n",
    "apps/demo/src/features/inbox/components/inbox-page.tsx":
      "export const InboxPage = () => null;\n",
    "apps/demo/src/features/posts/index.ts": "export const posts = 1;\n",
  };

  const caught = check(
    fixture({
      ...files,
      "apps/demo/src/features/posts/service.ts":
        'import { InboxPage } from "../inbox/components/inbox-page";\nexport const use = InboxPage;\n',
    }),
  );
  assert.deepEqual(rulesOf(caught), ["route-reach"]);

  const allowed = check(
    fixture({
      ...files,
      "apps/demo/src/app/inbox/page.tsx":
        'export { InboxPage as default } from "../../features/inbox/components/inbox-page";\n',
    }),
  );
  assert.deepEqual(allowed, []);
});

test("a relative import inside its own feature is how a feature talks to itself", () => {
  const root = fixture({
    "apps/demo/src/features/inbox/index.ts": "export const inbox = 1;\n",
    "apps/demo/src/features/inbox/queries.ts": "export const rows = [];\n",
    "apps/demo/src/features/inbox/components/inbox-page.tsx":
      'import { rows } from "../queries";\nexport const InboxPage = () => rows;\n',
    "apps/demo/src/features/inbox/components/list.tsx": `${CLIENT}import { rows } from "../queries";\nexport const List = () => rows;\n`,
  });

  assert.deepEqual(check(root), []);
});

test("a relative import from lib into a feature is resolved and caught", () => {
  const root = fixture({
    "apps/demo/src/features/orders/index.ts": "export const orders = 1;\n",
    "apps/demo/src/lib/mailer.ts":
      'import { orders } from "../features/orders";\nexport const send = () => orders;\n',
  });

  const violations = check(root);
  assert.deepEqual(rulesOf(violations), ["lib-type-only"]);
  assert.match(violations[0].reason, /"\.\.\/features\/orders" -> "@\/features\/orders"/);
});

test("a relative import that leaves src/ is nobody's business", () => {
  const root = fixture({
    "apps/demo/src/features/one/index.ts":
      'import { helper } from "../../../../packages/utils/helper";\nexport const one = helper;\n',
  });

  assert.deepEqual(check(root), []);
});

/** A feature whose model is whatever `model` says, with a barrel over it. */
function featureWith(model, barrel = 'export { one } from "./model";\n') {
  return {
    "apps/demo/src/features/one/index.ts": barrel,
    "apps/demo/src/features/one/model.ts": model,
  };
}

test("a model may not value-import the database, a driver or a Node built-in", () => {
  for (const specifier of [
    "@byteveda/db",
    "@byteveda/db/schema",
    "drizzle-orm",
    "resend",
    "ioredis",
    "node:crypto",
    "@/lib/env",
  ]) {
    const root = fixture(
      featureWith(`import { thing } from "${specifier}";\nexport const one = thing;\n`),
    );
    const violations = check(root);
    assert.deepEqual(rulesOf(violations), ["model-client-safe"], specifier);
    assert.equal(violations[0].path, "apps/demo/src/features/one/model.ts");
    assert.equal(violations[0].line, 1);
  }
});

test("a model may take those as types, and @byteveda/db/constants as a value", () => {
  const root = fixture(
    featureWith(
      [
        'import type { Row } from "@byteveda/db";',
        'import { MAIL_WORKSPACES } from "@byteveda/db/constants";',
        "export const one = MAIL_WORKSPACES;",
        "export type Thing = Row;",
        "",
      ].join("\n"),
    ),
  );

  assert.deepEqual(check(root), []);
});

test("a model may not value-import its own feature's server half", () => {
  for (const server of ["queries", "store", "service", "events"]) {
    for (const written of [`./${server}`, `@/features/one/${server}`]) {
      const root = fixture({
        ...featureWith(`import { thing } from "${written}";\nexport const one = thing;\n`),
        [`apps/demo/src/features/one/${server}.ts`]:
          'import { getDb } from "@byteveda/db";\nexport const thing = getDb;\n',
      });

      const violations = check(root);
      assert.deepEqual(rulesOf(violations), ["model-client-safe"], written);
      assert.match(violations[0].reason, /server half/);
    }
  }
});

test("a model may take a type from its own server half, and its components may import it", () => {
  const root = fixture({
    ...featureWith('import type { Row } from "./queries";\nexport type One = Row;\n'),
    "apps/demo/src/features/one/queries.ts":
      'import { getDb } from "@byteveda/db";\nexport type Row = { id: string };\nexport const rows = getDb;\n',
    "apps/demo/src/features/one/components/panel.tsx":
      'import { rows } from "../queries";\nexport const Panel = () => rows;\n',
  });

  assert.deepEqual(check(root), []);
});

test("a components-only feature's model is still held to client safety", () => {
  const root = fixture({
    "apps/demo/src/features/one/components/index.ts": 'export { Panel } from "./panel";\n',
    "apps/demo/src/features/one/components/panel.tsx": "export const Panel = () => null;\n",
    "apps/demo/src/features/one/components/model.ts":
      'import { getDb } from "@byteveda/db";\nexport const one = getDb;\n',
  });

  const violations = check(root);
  assert.deepEqual(rulesOf(violations), ["model-client-safe"]);
  assert.equal(violations[0].path, "apps/demo/src/features/one/components/model.ts");
});

test("a model.tsx and an index.tsx are not invisible", () => {
  const root = fixture({
    "apps/demo/src/features/one/index.tsx": 'export * from "./model";\n',
    "apps/demo/src/features/one/model.tsx":
      'import { getDb } from "@byteveda/db";\nexport const one = getDb;\n',
  });

  // front-door as well: a front door is an index.ts, and an index.tsx is not one.
  assert.deepEqual(rulesOf(check(root)), ["curated-barrel", "front-door", "model-client-safe"]);
});

test("a model may not read process.env", () => {
  const root = fixture(featureWith("export const one = process.env.ADMIN_URL ?? null;\n"));

  const violations = check(root);
  assert.deepEqual(rulesOf(violations), ["model-client-safe"]);
  assert.match(violations[0].reason, /process\.env/);
});

test("process.env in a model's own comment is not a read", () => {
  const root = fixture(
    featureWith("// The half that reads process.env lives in limits.ts.\nexport const one = 1;\n"),
  );

  assert.deepEqual(check(root), []);
});

test("only a feature-root model.ts is held to client safety", () => {
  const root = fixture({
    ...featureWith("export const one = 1;\n"),
    "apps/demo/src/features/one/queries.ts":
      'import { getDb } from "@byteveda/db";\nexport const rows = getDb;\n',
    "apps/demo/src/features/one/model.test.ts":
      'import { getDb } from "@byteveda/db";\nexport const fake = getDb;\n',
  });

  assert.deepEqual(check(root), []);
});

/** A `"use client"` component whose imports are whatever `body` says. */
function clientComponent(body) {
  return {
    "apps/demo/src/features/one/components/index.ts": 'export { Panel } from "./panel";\n',
    "apps/demo/src/features/one/components/panel.tsx": `${CLIENT}${body}`,
  };
}

test('a "use client" file may not value-import a driver or a Node built-in', () => {
  for (const specifier of [
    "@byteveda/db",
    "@byteveda/db/schema",
    "drizzle-orm",
    "resend",
    "ioredis",
    "node:crypto",
  ]) {
    const root = fixture(
      clientComponent(`import { thing } from "${specifier}";\nexport const Panel = () => thing;\n`),
    );

    const violations = check(root);
    assert.deepEqual(rulesOf(violations), ["client-safe"], specifier);
    assert.equal(violations[0].path, "apps/demo/src/features/one/components/panel.tsx");
    assert.equal(violations[0].line, 2);
  }
});

test('a "use client" file may take those as types, and open db/constants and @/lib', () => {
  const root = fixture(
    clientComponent(
      [
        'import type { Row } from "@byteveda/db";',
        'import { MAIL_WORKSPACES } from "@byteveda/db/constants";',
        'import { SITE } from "@/lib/site";',
        "export const Panel = (row) => [MAIL_WORKSPACES, SITE, row];",
        "",
      ].join("\n"),
    ),
  );

  // `@/lib/*` is barred from a model.ts and not from a client file: academy, flexiq and
  // main all render `@/lib/site` client-side. What that costs is documented, not checked.
  assert.deepEqual(check(root), []);
});

test("a component without the directive is a server component and may open the driver", () => {
  const root = fixture({
    "apps/demo/src/features/one/index.ts": 'export { Panel } from "./components/panel";\n',
    "apps/demo/src/features/one/components/panel.tsx":
      'import { getDb } from "@byteveda/db";\nexport const Panel = () => getDb();\n',
  });

  assert.deepEqual(check(root), []);
});

test("a feature barrel may not export *", () => {
  const root = fixture(featureWith("export const one = 1;\n", 'export * from "./model";\n'));

  const violations = check(root);
  assert.deepEqual(rulesOf(violations), ["curated-barrel"]);
  assert.equal(violations[0].path, "apps/demo/src/features/one/index.ts");
  assert.equal(violations[0].line, 1);
});

test("a components barrel may not export * either", () => {
  const root = fixture({
    "apps/demo/src/features/one/components/index.ts": 'export * from "./panel";\n',
    "apps/demo/src/features/one/components/panel.tsx": "export const Panel = () => null;\n",
  });

  assert.deepEqual(rulesOf(check(root)), ["curated-barrel"]);
});

test("an export * outside a barrel, or inside a comment, is left alone", () => {
  const root = fixture({
    ...featureWith("export const one = 1;\n"),
    "apps/demo/src/features/one/helpers.ts": 'export * from "./model";\n',
    "apps/demo/src/features/two/index.ts": '// export * from "./model";\nexport const two = 2;\n',
    "apps/demo/src/features/two/model.ts": "export const two = 2;\n",
  });

  assert.deepEqual(check(root), []);
});

/** The app-wide component barrel and one component on it, plus a feature that reaches it. */
function appComponents(reach) {
  return {
    "apps/demo/src/components/index.ts": 'export { Mark } from "./mark";\n',
    "apps/demo/src/components/mark.tsx": "export const Mark = () => null;\n",
    "apps/demo/src/features/one/index.ts": 'export { One } from "./components";\n',
    "apps/demo/src/features/one/components/index.ts": 'export { One } from "./panel";\n',
    "apps/demo/src/features/one/components/panel.tsx": reach,
  };
}

test("a feature may not reach the component barrel, in any spelling", () => {
  for (const written of [
    "@/components",
    "@/components/index",
    "../../../components",
    "../../../components/index",
  ]) {
    const root = fixture(
      appComponents(`import { Mark } from "${written}";\nexport const One = () => Mark;\n`),
    );

    const violations = check(root);
    assert.deepEqual(rulesOf(violations), ["component-barrel"], written);
    assert.equal(violations[0].path, "apps/demo/src/features/one/components/panel.tsx");
    assert.match(violations[0].reason, /app-wide component barrel/);
  }
});

test("a feature may name the component it wants, by either spelling", () => {
  for (const written of ["../../../components/mark", "@/components/mark"]) {
    const root = fixture(
      appComponents(`import { Mark } from "${written}";\nexport const One = () => Mark;\n`),
    );

    assert.deepEqual(check(root), [], written);
  }
});

test("a feature's own components/index.ts is not the app barrel", () => {
  const root = fixture({
    ...appComponents("export const One = () => null;\n"),
    "apps/demo/src/features/one/components/host.tsx":
      'import { One } from "./index";\nexport const Host = () => One;\n',
    "apps/demo/src/features/two/index.ts": 'export { Two } from "./components";\n',
    "apps/demo/src/features/two/components/index.ts": 'export { Two } from "./panel";\n',
    "apps/demo/src/features/two/components/panel.tsx":
      'import { Two } from "../../two/components";\nexport const Two = () => Two;\n',
  });

  assert.deepEqual(check(root), []);
});

test("code outside features/ may still open the component barrel", () => {
  const root = fixture({
    "apps/demo/src/components/index.ts": 'export { Mark } from "./mark";\n',
    "apps/demo/src/components/mark.tsx": "export const Mark = () => null;\n",
    "apps/demo/src/app/page.tsx":
      'import { Mark } from "../components";\nexport default function Page() {\n  return Mark;\n}\n',
  });

  assert.deepEqual(check(root), []);
});

/** Everything shared/ sits below, plus a `shared/format.ts` that reaches for `written`. */
function sharedReaching(written) {
  return {
    "apps/demo/src/components/index.ts": 'export { Mark } from "./mark";\n',
    "apps/demo/src/components/mark.tsx": "export const Mark = () => null;\n",
    "apps/demo/src/lib/index.ts": 'export { env } from "./env";\n',
    "apps/demo/src/lib/env.ts": "export const env = {};\n",
    "apps/demo/src/features/one/index.ts": 'export { one } from "./model";\n',
    "apps/demo/src/features/one/model.ts": "export const one = 1;\n",
    "apps/demo/src/shared/format.ts": `import { thing } from "${written}";\nexport const ago = thing;\n`,
  };
}

test("shared/ may not reach lib, features or components by a relative path", () => {
  for (const written of [
    "../lib",
    "../lib/index",
    "../lib/env",
    "../features/one",
    "../components",
    "../components/index",
    "../components/mark",
  ]) {
    const violations = check(fixture(sharedReaching(written)));
    assert.ok(
      violations.some((violation) => violation.rule === "shared-isolation"),
      written,
    );
    assert.equal(violations[0].path, "apps/demo/src/shared/format.ts");
    assert.match(violations[0].reason, /bottom of the app/);
  }
});

test("a relative reach out of shared/ past a feature's doors reports both rules", () => {
  const root = fixture({
    ...sharedReaching("../features/one/queries"),
    "apps/demo/src/features/one/queries.ts": "export const thing = [];\n",
  });

  assert.deepEqual(rulesOf(check(root)), ["feature-doors", "shared-isolation"]);
});

test("shared/ may still talk to itself, and to anything outside the app", () => {
  const root = fixture({
    ...sharedReaching("./bytes"),
    "apps/demo/src/shared/bytes.ts": "export const thing = 1;\n",
    "apps/demo/src/shared/nested/deep.ts":
      'import { thing } from "../bytes";\nimport { clsx } from "clsx";\nexport const deep = [thing, clsx];\n',
  });

  assert.deepEqual(check(root), []);
});
