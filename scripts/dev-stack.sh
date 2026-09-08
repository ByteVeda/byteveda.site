#!/usr/bin/env bash
#
# dev-stack.sh — bring the admin console up locally, optionally behind ngrok.
#
# The console needs four things before it can do anything: a database, a GitHub
# OAuth client, an allowlist, and applied migrations. This checks all four, tells
# you exactly which one is missing, and only then starts the dev server — rather
# than booting to a login page that fails on click with a redirect to /login.
#
# Tunnelling changes one thing that is easy to miss: GitHub redirects back to
# whatever origin started the handshake, so ADMIN_URL has to name the tunnel and
# the same URL has to be registered on the OAuth app. Passing --ngrok writes the
# first and prints the second.
#
# Usage:
#   bash scripts/dev-stack.sh                                   # localhost:3002
#   bash scripts/dev-stack.sh --port 3000
#   bash scripts/dev-stack.sh --ngrok https://abc123.ngrok-free.app --port 3000
#   bash scripts/dev-stack.sh --ngrok <url> --seed --with-flexiq
#
# Flags:
#   --ngrok <url>   public tunnel origin; sets ADMIN_URL and prints the callback
#   --port <n>      port the admin dev server binds (default 3002)
#   --seed          add the catalogue's packages and collect downloads once
#   --with-flexiq   also run the FlexiQ site, so publish → revalidate works
#   --skip-migrate  leave the database alone
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_ENV="$ROOT/apps/admin/.env.local"
FLEXIQ_ENV="$ROOT/apps/flexiq/.env.local"

NGROK_URL=""
ADMIN_PORT="3002"
SEED=0
WITH_FLEXIQ=0
SKIP_MIGRATE=0

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
warn() { printf '\033[33m! %s\033[0m\n' "$1"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }
ok() { printf '\033[32m✓\033[0m %s\n' "$1"; }

while [ $# -gt 0 ]; do
  case "$1" in
    # `pnpm stack -- --ngrok …` forwards the separator itself, so swallow it
    # rather than reporting the documented invocation as an unknown flag.
    --) shift ;;
    --ngrok) NGROK_URL="${2:-}"; shift 2 ;;
    --port) ADMIN_PORT="${2:-}"; shift 2 ;;
    --seed) SEED=1; shift ;;
    --with-flexiq) WITH_FLEXIQ=1; shift ;;
    --skip-migrate) SKIP_MIGRATE=1; shift ;;
    -h|--help) sed -n '2,28p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Unknown flag: $1 (try --help)" ;;
  esac
done

# ---------------------------------------------------------------- env helpers

# Last assignment wins, which is also how the dotenv loaders read these files.
read_env() {
  local file=$1 key=$2
  [ -f "$file" ] || return 0
  sed -n "s/^${key}=//p" "$file" | tail -1
}

# Rewrites rather than appends, so running this twice does not leave two lines
# of the same key disagreeing with each other.
write_env() {
  local file=$1 key=$2 value=$3 tmp
  tmp="$(mktemp)"
  [ -f "$file" ] && grep -v "^${key}=" "$file" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$file"
}

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 24 | tr -dc 'A-Za-z0-9'
  else
    node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"
  fi
}

# ------------------------------------------------------------------ 1. env file

bold "1. Environment"

if [ ! -f "$ADMIN_ENV" ]; then
  cp "$ROOT/apps/admin/.env.example" "$ADMIN_ENV"
  die "Created apps/admin/.env.local from the template. Fill it in, then run this again."
fi

MISSING=()
for key in DATABASE_URL GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET ADMIN_GITHUB_IDS; do
  [ -n "$(read_env "$ADMIN_ENV" "$key")" ] || MISSING+=("$key")
done

if [ ${#MISSING[@]} -gt 0 ]; then
  printf '\n'
  die "$(cat <<EOF
Set these in apps/admin/.env.local, then run this again:

  ${MISSING[*]}

A GitHub OAuth app lives at https://github.com/settings/developers.
Your numeric GitHub id: curl -s https://api.github.com/users/<login> | jq .id
EOF
)"
fi
ok "DATABASE_URL, GitHub client, and allowlist are set"

# ------------------------------------------------------------------ 2. origin

if [ -n "$NGROK_URL" ]; then
  NGROK_URL="${NGROK_URL%/}"
  case "$NGROK_URL" in
    https://*) ;;
    *) die "--ngrok needs the full https origin, e.g. https://abc123.ngrok-free.app" ;;
  esac
  write_env "$ADMIN_ENV" ADMIN_URL "$NGROK_URL"
  ORIGIN="$NGROK_URL"
  ok "ADMIN_URL set to $NGROK_URL"
else
  # A stale ADMIN_URL from a previous tunnel would send the callback to a dead
  # host, which reads as "GitHub is broken" rather than "that tunnel is gone".
  STALE="$(read_env "$ADMIN_ENV" ADMIN_URL)"
  if [ -n "$STALE" ]; then
    warn "ADMIN_URL is still $STALE — pass --ngrok <url> to update it, or delete the line for localhost."
  fi
  ORIGIN="http://localhost:$ADMIN_PORT"
fi

# ------------------------------------------------ 3. shared revalidate secret

SECRET="$(read_env "$ADMIN_ENV" REVALIDATE_SECRET)"
if [ -z "$SECRET" ]; then
  SECRET="$(random_secret)"
  write_env "$ADMIN_ENV" REVALIDATE_SECRET "$SECRET"
  ok "Generated a REVALIDATE_SECRET"
fi

# Publishing only reaches the site when both ends carry the same secret.
if [ -f "$FLEXIQ_ENV" ]; then
  if [ "$(read_env "$FLEXIQ_ENV" REVALIDATE_SECRET)" != "$SECRET" ]; then
    write_env "$FLEXIQ_ENV" REVALIDATE_SECRET "$SECRET"
    ok "Synced REVALIDATE_SECRET into apps/flexiq/.env.local"
  fi
elif [ "$WITH_FLEXIQ" -eq 1 ]; then
  warn "apps/flexiq/.env.local is missing; publish will not revalidate the site."
fi

# ---------------------------------------------------------------- 4. install

if [ ! -d "$ROOT/node_modules" ]; then
  bold "2. Dependencies"
  (cd "$ROOT" && pnpm install)
fi

# --------------------------------------------------------------- 5. migrate

if [ "$SKIP_MIGRATE" -eq 0 ]; then
  bold "2. Migrations"
  (cd "$ROOT" && pnpm --filter @byteveda/db db:migrate >/dev/null) \
    || die "Migrations failed. Check DATABASE_URL and DATABASE_SSL in packages/db/.env.local."
  ok "Schema is up to date"
fi

# ------------------------------------------------------------------ 6. seed

if [ "$SEED" -eq 1 ]; then
  bold "3. Download stats"
  # The collector exits non-zero when any registry 404s, which is a normal
  # outcome for a guessed package name and not a reason to stop.
  (cd "$ROOT" && pnpm --filter @byteveda/admin collect --seed) || true
fi

# ------------------------------------------------------------------ 7. go

CALLBACK="$ORIGIN/api/auth/callback"

printf '\n'
bold "Register this on the GitHub OAuth app"
printf '  Homepage URL              %s\n' "$ORIGIN"
printf '  Authorization callback    %s\n' "$CALLBACK"
printf '\n'

if [ -z "$NGROK_URL" ]; then
  printf 'Tunnelling? Run this in another shell, then re-run with --ngrok <url>:\n'
  printf '  ngrok http %s\n\n' "$ADMIN_PORT"
fi

bold "Starting"
printf '  admin   %s\n' "$ORIGIN"
[ "$WITH_FLEXIQ" -eq 1 ] && printf '  flexiq  http://localhost:3001\n'
printf '\n'

export ADMIN_PORT

cd "$ROOT"
if [ "$WITH_FLEXIQ" -eq 1 ]; then
  exec pnpm exec turbo run dev --filter=@byteveda/admin --filter=@byteveda/flexiq-site
else
  exec pnpm exec turbo run dev --filter=@byteveda/admin
fi
