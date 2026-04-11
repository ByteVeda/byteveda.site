#!/usr/bin/env bash
#
# sync-ui.sh — copy shared UI primitives + theme from byteveda.site into this repo.
#
# Usage:
#   bash scripts/sync-ui.sh                   # assumes ../byteveda.site
#   bash scripts/sync-ui.sh /abs/path/to/byteveda.site
#
# What is synced (verbatim):
#   - src/components/ui/**              (Button, Badge, Section, icons, etc.)
#   - src/components/theme-toggle.tsx
#   - src/components/footer.tsx
#   - src/providers/theme-provider.tsx
#   - src/lib/cn.ts
#   - src/lib/github.ts
#   - src/app/globals.css               (theme tokens + utilities)
#
# NOT synced (portal-specific — must be edited by hand):
#   - src/components/navbar.tsx         (docs has different nav items)
#   - src/components/docs-hero.tsx
#   - src/components/tool-card.tsx
#   - src/content/tools.ts
#   - src/lib/site.ts
#   - src/app/page.tsx
#   - src/app/layout.tsx

set -euo pipefail

SRC="${1:-../byteveda.site}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Resolve SRC relative to repo root if it's not absolute
if [[ "$SRC" != /* ]]; then
  SRC="$(cd "$REPO_ROOT/$SRC" 2>/dev/null && pwd || echo "$SRC")"
fi

if [ ! -d "$SRC/src/components/ui" ]; then
  echo "Error: byteveda.site not found at $SRC"
  echo "       Expected $SRC/src/components/ui to exist."
  echo ""
  echo "Usage: bash scripts/sync-ui.sh [path/to/byteveda.site]"
  exit 1
fi

echo "Syncing UI primitives from: $SRC"
echo "Into:                       $REPO_ROOT"
echo ""

cd "$REPO_ROOT"

mkdir -p src/components/ui src/components src/providers src/lib src/app

# 1. ui primitives — mirror the whole directory
rsync -a --delete "$SRC/src/components/ui/" "src/components/ui/"
echo "  ✓ src/components/ui/"

# 2. standalone files — overwrite individually
cp "$SRC/src/lib/cn.ts"                    "src/lib/cn.ts"
echo "  ✓ src/lib/cn.ts"

cp "$SRC/src/lib/github.ts"                "src/lib/github.ts"
echo "  ✓ src/lib/github.ts"

cp "$SRC/src/components/theme-toggle.tsx"  "src/components/theme-toggle.tsx"
echo "  ✓ src/components/theme-toggle.tsx"

cp "$SRC/src/providers/theme-provider.tsx" "src/providers/theme-provider.tsx"
echo "  ✓ src/providers/theme-provider.tsx"

cp "$SRC/src/app/globals.css"              "src/app/globals.css"
echo "  ✓ src/app/globals.css"

cp "$SRC/src/components/footer.tsx"        "src/components/footer.tsx"
echo "  ✓ src/components/footer.tsx"

echo ""
echo "Done. Portal-specific files (NOT touched):"
echo "  - src/components/navbar.tsx"
echo "  - src/components/docs-hero.tsx"
echo "  - src/components/tool-card.tsx"
echo "  - src/content/tools.ts"
echo "  - src/lib/site.ts"
echo "  - src/app/page.tsx"
echo "  - src/app/layout.tsx"
echo ""
echo "Review with: git status && git diff"
