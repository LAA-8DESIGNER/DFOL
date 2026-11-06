#!/usr/bin/env bash
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP="$ROOT/dfol_termux"
node --check "$APP/server.js"
node --check "$APP/public/app.js"
(cd "$APP" && npm test)
# Check that the distributable source tree contains no common generated/cache/build leftovers.
if find "$ROOT" -type d \( \
  -name node_modules -o -name __pycache__ -o -name .cache -o -name .pytest_cache -o \
  -name .mypy_cache -o -name .ruff_cache -o -name .npm -o -name .pnpm-store -o \
  -name .gradle -o -name .vite -o -name .next -o -name .turbo -o -name .git -o \
  -name coverage -o -name dist -o -name build -o -name target \) -print -quit | grep -q .; then
  echo "FAIL: known cache/build directory found in release tree." >&2
  exit 1
fi
if find "$ROOT" -type f \( \
  -name '*.pyc' -o -name '*.pyo' -o -name '.DS_Store' -o -name 'Thumbs.db' -o \
  -name '*.log' -o -name '*.tmp' -o -name '*.temp' -o -name '*.bak' -o -name '*.swp' -o \
  -name '*~' -o -name '.eslintcache' -o -name '.stylelintcache' -o -name '*.tsbuildinfo' -o -name '.coverage' \) -print -quit | grep -q .; then
  echo "FAIL: known generated/cache file found in release tree." >&2
  exit 1
fi
echo "DFOL release checks passed (syntax, tests, common cache/build artifact check)."
echo "Note: this does not replace a live Android/Termux export test."
