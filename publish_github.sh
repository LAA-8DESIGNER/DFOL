#!/usr/bin/env bash
# DFOL first-publication helper. Token is requested locally and never written to the repo.
set -Eeuo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
OWNER="LAA-8DESIGNER"
REPO="DFOL"
REMOTE_URL="https://github.com/${OWNER}/${REPO}.git"
API="https://api.github.com"

if ! command -v pkg >/dev/null 2>&1; then
  echo "This publishing helper is designed for Termux on Android." >&2
  echo "Run it in Termux, not in a browser shell." >&2
  exit 1
fi

for tool in git curl node; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    case "$tool" in
      git) pkg install git -y ;;
      curl) pkg install curl -y ;;
      node) pkg install nodejs -y ;;
    esac
  fi
done

if [ ! -f "$ROOT/dfol_termux/server.js" ] || [ ! -f "$ROOT/quickstart.sh" ]; then
  echo "Run this script from the extracted DFOL release root. Required files are missing." >&2
  exit 1
fi

# Check syntax, existing automated tests and accidental cache/build artifacts before publishing.
bash "$ROOT/verify_release.sh"

printf '\nTarget repository: https://github.com/%s/%s\n' "$OWNER" "$REPO"
printf 'A public repository will be created if it does not exist. Token entry stays hidden and is not saved.\n'
IFS= read -r -s -p 'GitHub token (enter locally; do not paste it into ChatGPT): ' GH_TOKEN
printf '\n'
if [ -z "$GH_TOKEN" ]; then
  echo "No token entered; nothing was uploaded." >&2
  exit 1
fi

TMP_BASE="${TMPDIR:-/data/data/com.termux/files/usr/tmp}"
mkdir -p "$TMP_BASE"
HEADER_FILE="$(mktemp "$TMP_BASE/dfol-gh-header.XXXXXX")"
RESPONSE_FILE="$(mktemp "$TMP_BASE/dfol-gh-response.XXXXXX")"
ASKPASS_FILE="$(mktemp "$TMP_BASE/dfol-gh-askpass.XXXXXX")"
CLONE_TEST_DIR="$(mktemp -d "$TMP_BASE/dfol-clone-test.XXXXXX")"
cleanup() {
  rm -f "$HEADER_FILE" "$RESPONSE_FILE" "$ASKPASS_FILE"
  rm -rf "$CLONE_TEST_DIR"
  unset GH_TOKEN DFOL_GITHUB_TOKEN DFOL_GITHUB_USER 2>/dev/null || true
}
trap cleanup EXIT INT TERM
chmod 600 "$HEADER_FILE" "$RESPONSE_FILE"
printf 'Authorization: Bearer %s\nAccept: application/vnd.github+json\nX-GitHub-Api-Version: 2022-11-28\n' "$GH_TOKEN" > "$HEADER_FILE"

api_call() {
  # Usage: api_call METHOD URL [JSON body]
  local method="$1" url="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -H "@$HEADER_FILE" -H 'Content-Type: application/json' -X "$method" --data "$body" -o "$RESPONSE_FILE" -w '%{http_code}' "$url"
  else
    curl -sS -H "@$HEADER_FILE" -X "$method" -o "$RESPONSE_FILE" -w '%{http_code}' "$url"
  fi
}

status="$(api_call GET "$API/user")"
if [ "$status" != "200" ]; then
  echo "GitHub authentication failed (HTTP $status). No source code was pushed." >&2
  cat "$RESPONSE_FILE" >&2
  exit 1
fi
ACTUAL_USER="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).login||"")}catch{process.exit(2)}})' < "$RESPONSE_FILE")"
if [ "${ACTUAL_USER,,}" != "${OWNER,,}" ]; then
  echo "Token belongs to '$ACTUAL_USER', but this release is configured for '$OWNER'. Nothing was uploaded." >&2
  echo "Use a token belonging to the intended account, or update OWNER in this script before publishing." >&2
  exit 1
fi

status="$(api_call GET "$API/repos/$OWNER/$REPO")"
if [ "$status" = "404" ]; then
  status="$(api_call POST "$API/user/repos" '{"name":"DFOL","description":"DFOL — Dump Folder: a local Termux project tree, source review, masking and export prototype by PRAKASHH / LAA-8DESIGNER.","private":false,"auto_init":false}')"
  if [ "$status" != "201" ]; then
    echo "Could not create the public repository (HTTP $status). Nothing was force-pushed." >&2
    cat "$RESPONSE_FILE" >&2
    exit 1
  fi
  echo "Created public repository: https://github.com/$OWNER/$REPO"
elif [ "$status" = "200" ]; then
  IS_PRIVATE="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).private?"true":"false")}catch{process.exit(2)}})' < "$RESPONSE_FILE")"
  if [ "$IS_PRIVATE" = "true" ]; then
    echo "The repository already exists but is private. This script will not expose its contents by changing visibility." >&2
    echo "Review it on GitHub and make it public manually only after confirming there is no sensitive history." >&2
    exit 1
  fi
  echo "Public repository already exists; checking whether it is empty or is this folder's existing remote."
else
  echo "Could not inspect the repository (HTTP $status)." >&2
  cat "$RESPONSE_FILE" >&2
  exit 1
fi

cat > "$ASKPASS_FILE" <<'ASKPASS_EOF'
#!/bin/sh
case "$1" in
  *Username*) printf '%s\n' "$DFOL_GITHUB_USER" ;;
  *Password*) printf '%s\n' "$DFOL_GITHUB_TOKEN" ;;
  *) exit 1 ;;
esac
ASKPASS_EOF
chmod 700 "$ASKPASS_FILE"
export DFOL_GITHUB_USER="$OWNER"
export DFOL_GITHUB_TOKEN="$GH_TOKEN"
export GIT_ASKPASS="$ASKPASS_FILE"
export GIT_TERMINAL_PROMPT=0
unset GH_TOKEN

# Never overwrite a pre-existing remote repository with unrelated history.
REMOTE_REFS="$(git ls-remote "$REMOTE_URL" 2>/dev/null || true)"
GIT=(git -c "safe.directory=$ROOT" -C "$ROOT")
LOCAL_REPO="no"
if "${GIT[@]}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then LOCAL_REPO="yes"; fi
CURRENT_ORIGIN=""
if [ "$LOCAL_REPO" = "yes" ]; then CURRENT_ORIGIN="$("${GIT[@]}" remote get-url origin 2>/dev/null || true)"; fi
if [ -n "$REMOTE_REFS" ] && [ "$CURRENT_ORIGIN" != "$REMOTE_URL" ]; then
  echo "The public repository already has commits and this folder is not its existing clone." >&2
  echo "For safety, nothing was pushed. Clone/merge the existing repository rather than overwriting its history." >&2
  exit 1
fi
if [ "$LOCAL_REPO" = "no" ]; then
  git -c "safe.directory=$ROOT" init -b main "$ROOT"
fi
if [ -n "$CURRENT_ORIGIN" ] && [ "$CURRENT_ORIGIN" != "$REMOTE_URL" ]; then
  echo "This folder already has a different origin remote: $CURRENT_ORIGIN" >&2
  echo "Nothing was pushed. Review the remote before changing it." >&2
  exit 1
elif [ -z "$CURRENT_ORIGIN" ]; then
  "${GIT[@]}" remote add origin "$REMOTE_URL"
fi
"${GIT[@]}" config core.filemode false
"${GIT[@]}" config user.name "PRAKASHH"
"${GIT[@]}" config user.email "prakashh93168@gmail.com"
"${GIT[@]}" add -A
if ! "${GIT[@]}" rev-parse --verify HEAD >/dev/null 2>&1; then
  if "${GIT[@]}" diff --cached --quiet; then
    echo "No project files are staged. Refusing to create an empty release commit." >&2
    exit 1
  fi
  "${GIT[@]}" commit -m "Release DFOL 8.0.0"
else
  if ! "${GIT[@]}" diff --cached --quiet; then
    "${GIT[@]}" commit -m "Update DFOL production release"
  fi
fi
"${GIT[@]}" branch -M main
"${GIT[@]}" push -u origin main

# Validate that ordinary users can clone the now-public repository anonymously.
echo
echo "Testing public clone in a disposable temporary directory..."
if git clone --depth 1 "$REMOTE_URL" "$CLONE_TEST_DIR/DFOL" >/dev/null 2>&1 && \
  [ -f "$CLONE_TEST_DIR/DFOL/quickstart.sh" ] && \
  [ -f "$CLONE_TEST_DIR/DFOL/dfol_termux/server.js" ] && \
  bash -n "$CLONE_TEST_DIR/DFOL/quickstart.sh"; then
  echo "PUBLIC CLONE TEST: PASS. Temporary clone will now be removed."
else
  echo "PUBLIC CLONE TEST: NOT CONFIRMED. Push may have succeeded, but check internet/repository visibility and retry the clone test." >&2
fi

printf '\nPublished: https://github.com/%s/%s\n' "$OWNER" "$REPO"
printf 'One-command Termux install for everyone:\n'
printf 'pkg install git -y && git clone https://github.com/%s/%s.git && cd %s && bash quickstart.sh\n' "$OWNER" "$REPO" "$REPO"
printf '\nThe token was used only for this session and is not embedded in the remote URL or project files.\n'
