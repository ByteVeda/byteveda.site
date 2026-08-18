#!/usr/bin/env bash
#
# pull-tool-docs.sh — mirror each tool's built docs into the portal export.
#
# GitHub Pages binds one custom domain to one repository, so the tool repos
# cannot serve subpaths of docs.byteveda.org themselves. Instead this pulls the
# docs each tool's own workflow already builds and unpacks it under out/<slug>/.
# Every tool builds with base path /<slug> (see `DOCS_BASE_PATH` in
# ByteVeda/flexiq .github/workflows/docs.yml), so the tree drops in unmodified
# and its absolute asset URLs stay correct.
#
# Their own byteveda.github.io/<slug>/ sites keep working; this mirrors, not moves.
#
# Preferred artifact is `docs-dist`, which the tool repos upload with a long
# retention. `github-pages` is only a fallback: actions/upload-pages-artifact
# hardcodes a 1-day retention, so it is gone by the time the portal next builds.
#
# Usage:  GH_TOKEN=<token with Actions: read on the org> bash scripts/pull-tool-docs.sh [out-dir]
set -euo pipefail

ORG=ByteVeda
OUT=${1:-apps/docs/out}

# Keep in sync with packages/utils/src/projects.ts
SLUGS=(flexiq paperjam agenteval reclink dagron)

missing=()

for slug in "${SLUGS[@]}"; do
  # Scope to the default branch: the tool repos guard their upload step to
  # push/workflow_dispatch, so a pull_request run — a dependabot PR, say — is
  # "successful" but carries no artifact. `--branch` matches the head branch,
  # which excludes PR runs.
  branch=$(gh api "repos/$ORG/$slug" --jq .default_branch 2>/dev/null || true)
  run_id=$(gh run list -R "$ORG/$slug" --workflow docs.yml --branch "$branch" --status success \
    --limit 1 --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null || true)

  if [ -z "$run_id" ]; then
    missing+=("$slug — no successful docs.yml run on $branch")
    continue
  fi

  tmp=$(mktemp -d)
  name=""
  for candidate in docs-dist github-pages; do
    if gh run download -R "$ORG/$slug" "$run_id" -n "$candidate" -D "$tmp" >/dev/null 2>&1; then
      name=$candidate
      break
    fi
  done

  if [ -z "$name" ]; then
    missing+=("$slug — no downloadable docs artifact on run $run_id (expired?)")
    rm -rf "$tmp"
    continue
  fi

  rm -rf "${OUT:?}/$slug"
  mkdir -p "$OUT/$slug"
  # `github-pages` wraps the tree in a tar; `docs-dist` is the tree itself.
  if [ -f "$tmp/artifact.tar" ]; then
    tar -xf "$tmp/artifact.tar" -C "$OUT/$slug"
  else
    cp -r "$tmp/." "$OUT/$slug/"
  fi
  rm -rf "$tmp"
  echo "  ✓ $slug — $(find "$OUT/$slug" -type f | wc -l) files from $name"
done

if [ ${#missing[@]} -gt 0 ]; then
  # Not fatal: a stale tool should cost one subpath, not the whole portal deploy.
  echo
  for m in "${missing[@]}"; do echo "::warning::tool docs missing — $m"; done
fi
