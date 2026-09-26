# Changesets

Only `@byteveda/ui` is published; every other workspace package is private and
Changesets skips it.

A PR that changes what `@byteveda/ui` ships adds a changeset:

```sh
pnpm changeset
```

On `main`, the Release workflow gathers pending changesets into a "Version
Packages" PR. Merging that PR publishes to npm.
