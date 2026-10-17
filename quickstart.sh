#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

REPO_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_DIR="$REPO_ROOT/dfol_termux"

if [ ! -f "$APP_DIR/server.js" ]; then
  echo "DFOL source was not found at: $APP_DIR" >&2
  echo "Keep the repository layout intact, including the dfol_termux/ folder." >&2
  exit 1
fi

if ! command -v pkg >/dev/null 2>&1; then
  echo "This quickstart targets Android Termux. On other systems, review the port/path assumptions in the documentation." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  pkg install nodejs -y
fi
if ! command -v zip >/dev/null 2>&1; then
  pkg install zip -y
fi

if [ ! -d "$HOME/storage/shared" ] && command -v termux-setup-storage >/dev/null 2>&1; then
  termux-setup-storage
fi

cd "$APP_DIR"
echo "DFOL 8.0.0 — Dump Folder"
echo "Local URL: http://127.0.0.1:3001"
echo "Workflow state remains restorable on browser refresh while this server stays running."
echo "Stop the server with Ctrl+C. Keep this terminal visible for raw-export OTP authorization."
exec node server.js
