#!/usr/bin/env bash
#
# Export TURBO_SCM_BASE — the commit `turbo --affected` diffs against.
#
# `BASE_SHA` is the pull request's base commit, or the commit a push replaced.
# GitHub leaves it empty (or all zeroes) for the first push to a branch, and a
# force-push can leave a commit that is no longer in the clone. Falling back to
# the parent of HEAD keeps the run honest: a base that cannot be resolved would
# otherwise make turbo compare against nothing and skip every package.
set -euo pipefail

base="${BASE_SHA:-}"

if [ -z "$base" ] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  base="$(git rev-parse HEAD^ 2>/dev/null || git rev-parse HEAD)"
  echo "Base '${BASE_SHA:-unset}' is not usable; falling back to ${base}."
fi

echo "TURBO_SCM_BASE=${base}" >> "$GITHUB_ENV"
echo "Comparing against ${base}."
