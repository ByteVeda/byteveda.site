# ByteVeda web

Monorepo for the ByteVeda websites.

## Development

```bash
pnpm install
pnpm dev
```

## Project layout

Each app is `app/` routes, `features/` domains, `lib/` adapters. Read
[AGENTS.md](AGENTS.md) before adding a file — the layering is enforced by
`pnpm lint` and `pnpm check:arch`.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

---

[byteveda.org](https://byteveda.org) · [docs.byteveda.org](https://docs.byteveda.org)
