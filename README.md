# ByteVeda web

Monorepo for the ByteVeda websites. pnpm workspaces + Turborepo, Next.js 16, Tailwind v4, Biome.

```text
apps/
  main/        byteveda.org          → Vercel
  docs/        docs.byteveda.org     → GitHub Pages (static export)
  flexiq/      flexiq.byteveda.org   → Vercel (FlexiQ product site)
packages/
  ui/          @byteveda/ui          primitives, theme tokens, hero effects
  utils/       @byteveda/utils       cn / url / github helpers, org constants, project catalogue
  config/      @byteveda/config      shared tsconfig, Biome rules, Lighthouse budgets
  analytics/   @byteveda/analytics   Web Vitals beacon
  flexiq-sim/  @byteveda/flexiq-sim  deterministic simulation of FlexiQ's scheduler
```

## Getting started

```bash
pnpm install

pnpm dev          # byteveda.org on :3000
pnpm dev:docs     # docs portal on :3001
pnpm dev:flexiq   # FlexiQ product site
pnpm dev:all      # all three at once
```

## Checks

```bash
pnpm lint         # Biome, once from the root over apps/** and packages/**
pnpm typecheck    # tsc --noEmit per workspace, via turbo
pnpm test         # vitest for flexiq-sim + Playwright for the FlexiQ site
pnpm build        # next build for every app
pnpm lighthouse   # Lighthouse budgets for every app (builds first)
pnpm fetch:news   # refresh apps/main/src/features/news/data/news.json
```

`pnpm test` builds and serves the FlexiQ site for its browser tests, so it is the
slow one. Scope it while iterating: `pnpm --filter @byteveda/flexiq-site test`.

Anything scoped to one workspace: `pnpm --filter @byteveda/main <script>`.

## Working in the monorepo

- **Shared code goes in `packages/`.** Both apps consume raw TypeScript from the
  workspace, so each app lists the packages in `transpilePackages`.
- **Dependency versions live in the `catalog:` block of `pnpm-workspace.yaml`.**
  App manifests reference `catalog:` rather than a version range, which is what
  keeps the two apps on identical Next/React builds.
- **Design tokens and primitive styles live in `@byteveda/ui/styles`.** An app's
  `globals.css` imports `tailwindcss`, then the package stylesheet, then only its
  own page-level CSS. Tailwind scans the package through an `@source` directive
  inside that stylesheet.
- **Theme switching is `data-theme` on `<html>`** (next-themes), not a `.dark` class.

## Performance

Measured in three layers, because no single one of them is trustworthy alone.

**Byte budgets — these fail a pull request.** Each app has a `lighthouserc.js`
declaring transfer-size ceilings for scripts, fonts and the page total, plus a
DOM-node ceiling. The numbers came from measuring the app and adding roughly 20%,
and they are identical on every run, so a red build means the diff added weight.
Raising a ceiling is a deliberate edit with a reason, not a retry.

**Wall-clock metrics — these only warn.** LCP, TBT, CLS and Speed Index are
collected over three runs and reported at the median. A shared CI runner moves
them ±30% between runs; treating that as a gate teaches everyone to ignore CI.
The same applies to `unused-javascript` and `render-blocking-resources`, whose
numeric values move with Lighthouse's heuristics rather than with the diff.

**Field data.** `<WebVitals />` from `@byteveda/analytics` sits in all three root
layouts and posts Core Web Vitals to `NEXT_PUBLIC_VITALS_ENDPOINT`. It is inert
when that is unset. It is built on `next/web-vitals`, so the only thing coupled
to a provider is the URL. `main` and `flexiq` additionally mount Vercel's
`<SpeedInsights />` as a second sink; the docs export on Pages does not.

```bash
pnpm lighthouse                                  # every app
pnpm --filter @byteveda/flexiq-site lighthouse   # one app

# Audit a deployed origin instead of a local production build. Any host — the
# override is a URL, and nothing in the config knows who serves it.
LHCI_TARGET_URL=https://byteveda.org pnpm --filter @byteveda/main lighthouse
```

The same override drives the `Lighthouse` workflow: run it from the Actions tab
with a `target_url` to audit a preview deploy, or leave it blank and it builds
and serves each app itself. Reports land as run artifacts.

## Deployment

| App | Target | Notes |
| --- | --- | --- |
| `apps/main` | Vercel | Project root directory is `apps/main`; build `pnpm turbo run build --filter=@byteveda/main` |
| `apps/docs` | GitHub Pages | `.github/workflows/deploy-docs.yml` publishes `apps/docs/out`; `public/CNAME` binds the custom domain |
| `apps/flexiq` | Vercel | Separate project, root directory `apps/flexiq`; build `pnpm turbo run build --filter=@byteveda/flexiq-site`. Point a `flexiq` CNAME at Vercel. |

### The FlexiQ site

`flexiq.byteveda.org` is the product's marketing surface — the pitch, an
interactive playground, and a blog. It links out to `docs.byteveda.org/flexiq`
for reference material rather than restating it.

The home page deliberately does **not** mirror the docs landing page. That page
is a feature grid and a comparison table, which is what every task queue's home
page is; a second copy of it on a second domain persuades nobody. This one makes
one argument in five moves — the broker is the part you can delete (hero), what
that is worth in processes you operate (ledger), the queue failing on purpose so
the reader can judge it (lab), the capability with no equivalent elsewhere
(interop), and the source for the claim most likely to be hand-waved (source).
When adding to it, add to the argument or leave it alone.

The lab and the playground both run `@byteveda/flexiq-sim`, a deterministic
TypeScript simulation of FlexiQ's documented scheduling semantics — priorities,
the Full Jitter backoff curve, rate limits, dead-lettering and cron. It is a
simulation, labelled as one on the page, not the Rust engine compiled to WASM.
Its behaviour is pinned by a vitest suite so it cannot quietly drift away from
what the core does; where the two are meant to agree, the test names say which
Rust function is being mirrored.

### Per-tool docs

`docs.byteveda.org/<slug>/` serves documentation built in each tool's own repo. A
custom domain belongs to exactly one repository, so the tool repos cannot serve those
subpaths themselves — `scripts/pull-tool-docs.sh` mirrors their build output into the
portal export instead, and the deploy runs daily to pick up new publishes. Each tool's
own `byteveda.github.io/<slug>/` site is unaffected.

Requires a `DOCS_ARTIFACT_TOKEN` secret with `Actions: read` on the org.
