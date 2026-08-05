# ByteVeda web

Monorepo for the ByteVeda websites. pnpm workspaces + Turborepo, Next.js 16, Tailwind v4, Biome.

```text
apps/
  main/        byteveda.org        → Vercel
  docs/        docs.byteveda.org   → GitHub Pages (static export)
packages/
  ui/          @byteveda/ui        primitives, theme tokens, hero effects
  utils/       @byteveda/utils     cn / url / github helpers, org constants, project catalogue
  config/      @byteveda/config    shared tsconfig + Biome rules
```

## Getting started

```bash
pnpm install

pnpm dev          # byteveda.org on :3000
pnpm dev:docs     # docs portal on :3001
pnpm dev:all      # both at once
```

## Checks

```bash
pnpm lint         # Biome, once from the root over apps/** and packages/**
pnpm typecheck    # tsc --noEmit per app, via turbo
pnpm build        # next build for both apps
pnpm fetch:news   # refresh apps/main/src/features/news/data/news.json
```

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

## Deployment

| App | Target | Notes |
| --- | --- | --- |
| `apps/main` | Vercel | Project root directory is `apps/main`; build `pnpm turbo run build --filter=@byteveda/main` |
| `apps/docs` | GitHub Pages | `.github/workflows/deploy-docs.yml` publishes `apps/docs/out`; `public/CNAME` binds the custom domain |

### Per-tool docs

`docs.byteveda.org/<slug>/` serves documentation built in each tool's own repo. A
custom domain belongs to exactly one repository, so the tool repos cannot serve those
subpaths themselves — `scripts/pull-tool-docs.sh` mirrors their build output into the
portal export instead, and the deploy runs daily to pick up new publishes. Each tool's
own `byteveda.github.io/<slug>/` site is unaffected.

Requires a `DOCS_ARTIFACT_TOKEN` secret with `Actions: read` on the org.
