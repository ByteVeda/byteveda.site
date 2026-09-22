# Architecture

Read this before you add a file to an app. It is short on purpose: five minutes now
saves the next person an afternoon of wondering why the same domain is spread across
four folders.

The one idea underneath everything here is that **a domain and its UI live together,
and a folder that talks to the outside world stays a folder that talks to the outside
world**. A `lib/` that quietly grows domain logic is how the previous structure rotted:
by the end, `lib/` held twenty-odd directories, `views/` held the screens for them, and
answering "where does subscriber confirmation live?" meant opening three folders.

## The shape

Every app under `apps/` follows the same layout. Not every app has every folder — a
mostly-static marketing site has no `shared/` — but where a folder exists, it means
this and nothing else:

```
apps/<app>/src/
  app/          Routes only. A page.tsx or layout.tsx is a few lines: it re-exports
                its screen from a feature and sets metadata. Route handlers under
                app/api/ are thin too — parse, call a feature, respond.
  features/     One folder per domain. Everything about that domain lives inside it:
                its types, its reads, its writes, its server actions, its UI.
  lib/          Adapters to things outside this process, and nothing else. Resend,
                ioredis, the GitHub REST API, package-registry HTTP, process.env.
                If it knows what a "subscriber" is, it is not an adapter.
  components/   UI shared across features. A nav rail, a confirm dialog, a page
                header. No domain knowledge.
  shared/       Pure helpers that could be lifted into any other project unchanged —
                formatting, logging, CORS. It imports nothing of ours.
```

`views/` does not exist. It used to; it is gone, and a screen now sits in
`features/<name>/components/` next to the queries it renders.

## The file vocabulary

Inside a feature, filenames are a fixed vocabulary. Same words, every feature, every
app.

| File | Holds | Runs on |
| --- | --- | --- |
| `model.ts` | Types, constants, pure rules. No I/O. | Either — **client-safe** |
| `queries.ts` | Reads. | Server |
| `store.ts` | Writes. | Server |
| `actions.ts` | `"use server"` entry points. | Server |
| `service.ts` | Orchestration across adapters. | Server |
| `events.ts` | The realtime channels this feature owns. | Server |
| `components/` | The UI for this feature. | Either |
| `index.ts` | Public API — curated *named* re-exports, never `export *`. | — |

**A feature that needs none of a file simply does not have it.** There are no empty
placeholders. `admin/features/seo` is a `model.ts`, a test and an `index.ts`;
`flexiq/features/hero-fx` is a `components/` folder and nothing more. A feature that is
*only* components keeps its model inside them — `main/features/contribute` is
`components/{contribute.tsx,model.ts,index.ts}` and has no front door at all, because it
has no server API to put on one. All of that is correct, not unfinished.

**A file outside the vocabulary needs a reason** that survives the question "why does
this feature have a word the others don't?" Across all 23 features in the four apps that
have a `features/` directory — `admin`, `academy`, `flexiq`, `main`; `docs` has none —
six entries have earned one.

Five are the same reason: `model.ts` is client-safe, so it cannot touch `node:crypto`,
`process.env` or `@/lib/env`, and the code that needs those has to live somewhere.

- `admin/features/auth/crypto.ts` — token hashing and cookie options; `node:crypto`, `process.env`.
- `admin/features/auth/allowlist.ts` — who may sign in; `process.env`.
- `admin/features/auth/urls.ts` — absolute URLs; `@/lib/env`.
- `admin/features/attachments/limits.ts` — upload ceilings; `process.env`.
- `admin/features/mail/webhook.ts` — Svix signature verification; `node:crypto`.

The sixth is a different reason and the only off-vocabulary *directory*:

- `main/features/news/data/` — a checked-in `news.json` snapshot that `model.ts` imports
  and `pnpm fetch:news` refreshes. Data, not code; client-safe, so the model may have it.

Six is the whole list as of this writing, and it is a snapshot, not a law — re-derive it
before you trust it. No tool checks this rule: the vocabulary is enforced by review, so
the census only stays honest if someone adding a seventh entry updates this list and
says why.

## The four rules

Each rule has a reason attached, because a rule whose reason is forgotten is a rule
somebody deletes.

### 1. One vocabulary, used by every feature

`queries.ts` reads in every feature. `store.ts` writes in every feature. Nobody gets a
`repository.ts` or a `data.ts` or a `helpers.ts`.

*Why:* so that reading one feature teaches you how to navigate all of them. The cost of
a private naming scheme is not paid by the person who writes it.

### 2. Dependencies point one way

```
app/  ->  features/  ->  lib/ + shared/
```

`lib/` never imports `features/`. `shared/` imports nothing of ours — not `@/lib`, not
`@/features`, not `@/components`. If a helper in `shared/` needs one of those, it is not
shared code and it belongs in the feature that wanted it.

*Why:* a cycle is not a style problem, it is a signal that something is in the wrong
folder. `lib/broadcasts/service.ts` reaching `@/features/subscribers`, which reached a
page, which reached `@/features/broadcasts`, was not a clever bit of reuse — it was
domain logic sitting in `lib/` and refusing to admit it.

### 3. Features talk through their front door

Server code in one feature reaches another through `@/features/<name>` — the barrel —
and never `@/features/<name>/queries`, `/store` or `/service`. `index.ts` exports what
is used outside the feature and nothing more; no dead exports, and no `export *`, which
is a door with no lock.

*Why:* deep imports are what turn twelve folders into one folder with twelve names. Once
`posts/` reaches into `inbox/queries.ts`, `inbox/queries.ts` cannot change without a
search across the app, and the boundary you drew is decoration.

This holds for relative paths too. `../inbox/queries` from inside `features/posts/` is
the same import spelled differently, and is checked the same way. Relative imports
*within* your own feature — `./model`, `../queries` from your own `components/` — are how
a feature talks to itself and are fine.

### 4. The server/client boundary is structural, not remembered

This is the rule that has actually broken things, so it is the one with teeth.

`@byteveda/db` drags `pg` into any bundle that touches it. A single import edge from a
client component to a module that reaches the database is enough to pull a Postgres
driver into the browser. You cannot rely on remembering; the structure has to make it
hard.

So:

- **`index.ts` is the server front door and carries no components.** It exports
  `model`, `queries`, `store`, `actions`, `service` — the feature's server API.
- **The client-safe doors are `model`, `actions` and `components`.** A `"use client"`
  file may import `@/features/<name>/model`, `@/features/<name>/actions` or
  `@/features/<name>/components`, and **never the barrel**, and never a path *inside*
  `components/`. (`"use server"` modules become RPC stubs in the client bundle, which is
  why `actions.ts` is safe.)
- **`features/<name>/components/index.ts` exports only client-safe components.** A
  feature with no reusable client component simply has no `components/index.ts`.
- **A route file reaches its screen by that component's own path.** This is the one
  lawful deep reach:

  ```ts
  export { InboxPage as default } from "@/features/inbox/components/inbox-page";
  ```

  It applies to `page.tsx` and `layout.tsx` alike. A page or a layout is a server
  component, so it cannot sit behind the client-safe `components/index.ts` — and it must
  not sit on the root barrel either.

Two pieces of real history explain the shape:

`lib/settings/registry.ts` existed only so the settings form — a client component —
could render labels and defaults without importing the store and pulling `pg` into the
bundle. Its own doc comment said so. That file is `features/settings/model.ts` now:
"the same data with nothing behind it" is exactly what a `model.ts` is, and once the
vocabulary exists, the workaround has a name.

`features/inbox/index.ts` once did `export { InboxPage } from "./components"`. The
Resend webhook route handler imports `{ inboxChanged, recordInbound }` from
`@/features/inbox`. Nobody wrote a bad import — but the barrel meant that a server-only
route handler pulled the entire inbox client-component graph into its bundle. Barrels
that re-export components are how that happens silently, every time.

## How it is enforced

Both commands run in CI's `verify` job, and both fail the build.

**`pnpm lint`** — Biome. The `noRestrictedImports` rules in `biome.json` own everything
that can be decided from the specifier string plus the path of the importing file:

- the feature doors on `@/features/*/*` (allowing `model`, `actions`, `components`),
- the extra `components/<file>` allowance for `app/**/page.tsx` and `app/**/layout.tsx`,
- `lib/` may not import `@/features/**`,
- `shared/` may not import `@/lib`, `@/features` or `@/components`,
- a file under `features/` may not import the `@/components` barrel itself.

If your failure message is a paragraph of prose about doors, it came from `biome.json`
and that is the file to read.

**`pnpm check:arch`** — `scripts/check-architecture.mjs`. It owns the rules Biome
structurally cannot express, because they depend on file *contents*, directory *shape*,
or a specifier Biome never resolves. Seven rules, each named in the failure output:

| Rule | What it catches |
| --- | --- |
| `client-door` | A `"use client"` file opening anything but `model`, `actions` or `components`. Needs to read the directive, which Biome cannot. |
| `front-door` | A feature with anything at its root besides `components/` and no `index.ts`. A directory-shape check, not an import check. |
| `route-reach` | Only `app/**/page.tsx` and `app/**/layout.tsx` may name a component file — and not even they may reach deeper than that file. |
| `lib-type-only` | `lib/` importing a feature. A type-only import is erased before bundling and is allowed; Biome cannot tell `import type` from a value import. |
| `feature-doors` | The relative spelling of rule 3. `../inbox/queries` is invisible to Biome, which matches the literal specifier; the script resolves it against `src/` first. |
| `model-client-safe` | A `model.ts` value-importing `@byteveda/db`, `drizzle-orm`, `resend`, `ioredis`, a `node:` built-in or `@/lib/*`, reading `process.env`, or reaching its own feature's server half (`./queries`, `./store`, `./service`, `./events`) — that last one is the same hole one hop out. `import type` and `@byteveda/db/constants` are fine. Covers `features/<name>/model.ts` and `features/<name>/components/model.ts` alike, so a components-only feature is held to it too. Every other rule assumes a model is client-safe; this is the one that checks. |
| `curated-barrel` | `export *` in a feature's `index.ts` or its `components/index.ts`. A star puts every symbol of that module on the door, including whatever is added to it later. |

If your failure message is `path:line [rule-name] reason`, it came from the script.

Its own fixture tests (`pnpm check:arch:test`) run first in CI, so a check that has
quietly stopped checking anything fails loudly instead of passing forever.

The script covers every `.ts`/`.tsx` under `apps/*/src`. Deliberately **not**
`apps/*/scripts` — those one-shot `tsx` scripts sit outside the app's import graph and
outside any bundle, and they reach into feature internals on purpose because they cannot
load `next/headers`.

### What no tool checks

Know where the structure is held by a tool and where it is held by people. Three gaps,
each confirmed against the current checks rather than assumed:

- **A barrel's *named* re-exports.** `curated-barrel` bans `export *`, but a curated
  `index.ts` can still put a component on the server door — `export { Card } from
  "./components";` passes both tools. That is exactly the shape that once put the inbox
  client graph in a webhook route. Proving it wrong means following the re-export graph,
  which neither tool does; `client-door` catches the symptom, not the cause.
- **A `components/index.ts` exporting a server component.** Nothing reads a component to
  decide which half it belongs to, so a server component sitting on the client door is
  invisible to both tools.
- **The relative spelling of the `@/components` ban.** Biome matches the literal
  specifier, so `@/components` from inside a feature errors while `../../components` —
  the same barrel, same graph — does not, and the arch script has no rule for it. The
  `feature-doors` rule exists because relative spellings evade Biome; this one is the
  same hole, still open.

Two more are judgement, not oversight: whether a file outside the vocabulary has earned
its name, and whether a barrel export is still used outside the feature. Neither is
mechanical, and both are what review is for.

## The exceptions that exist

There is one real exception, and being honest about it is worth more than a tidy list.

**`apps/academy/src/lib/site.ts` value-imports `PRICING` from `@/features/pricing`** to
put a price in the site's meta description. It is a genuine `lib/` -> `features/`
runtime edge, and nothing behaviour-preserving removes it. It is carved out by name in
both tools — in `biome.json` and as `LIB_VALUE_IMPORT_EXEMPTION` in
`check-architecture.mjs` — so the carve-out is one file and one specifier, not a
loosened rule. **The real fix is for the site metadata to take the price as an argument
rather than import the feature.** Until someone does that, this edge is allowed and no
other.

Separately, Biome flags `import type` exactly like a value import — it cannot tell them
apart. Two academy adapters (`lib/orders/service.ts` and `lib/email/templates.ts`) take
`import type` only from `@/features/orders`, which is erased before bundling and leaves
no runtime edge. They are exempted in `biome.json` for that reason, and the arch script's
`lib-type-only` rule is what actually holds them to types. Remove the type-only-ness and
the script fails even though Biome stays quiet.

## When a rule is wrong

Sometimes it will be. Rules written against one shape of problem meet another.

**Change the rule, deliberately, in its own commit, with the reasoning in the message.**
Edit `biome.json` or `check-architecture.mjs`, say why in the commit body, and let the
diff be reviewable on its own.

**Do not add an exception quietly.** Not an `// biome-ignore` on the line that hurt, not
a new path in an `includes` array on your way past, not a special case tucked into a
feature commit. The two exceptions above are written down here, named in both configs,
and carry the fix that would retire them — that is the bar.

An exception nobody can find is how the last structure rotted. This one is only as good
as the next person's willingness to leave it legible.
