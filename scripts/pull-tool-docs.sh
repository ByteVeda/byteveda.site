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
#
# Optional:  DOCS_PIN_SLUG / DOCS_PIN_RUN_ID pin one slug to one run, set from a
# `tool-docs-published` repository_dispatch payload. See PIN below.
set -euo pipefail

ORG=ByteVeda
OUT=${1:-apps/docs/out}

# PIN: a tool repo dispatches from the deploy job of the very run that built the
# docs, so that run is still in progress and the `--status success` lookup below
# would pick up its predecessor. Its `docs-dist` upload happened in the earlier
# build job, so downloading by run id is already safe. Ignored for any other slug
# and for a payload that is not a plain run id.
PIN_SLUG=${DOCS_PIN_SLUG:-}
PIN_RUN_ID=${DOCS_PIN_RUN_ID:-}
if [ -n "$PIN_RUN_ID" ] && ! [[ $PIN_RUN_ID =~ ^[0-9]+$ ]]; then
  echo "::warning::ignoring non-numeric DOCS_PIN_RUN_ID"
  PIN_RUN_ID=""
fi

# Keep in sync with packages/utils/src/projects.ts.
# paperjam is archived: its docs.yml never runs again, so this pulls the frozen
# last run until that artifact expires, then warns.
SLUGS=(flexiq paperjam agenteval reclink dagron)

missing=()

for slug in "${SLUGS[@]}"; do
  if [ -n "$PIN_RUN_ID" ] && [ "$slug" = "$PIN_SLUG" ]; then
    run_id=$PIN_RUN_ID
    echo "  · $slug — pinned to dispatching run $run_id"
  else
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
