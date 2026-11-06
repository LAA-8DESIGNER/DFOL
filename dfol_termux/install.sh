#!/data/data/com.termux/files/usr/bin/bash
set -eu

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${DFOL_TARGET_DIR:-${HOME}/dfol-app}"

mkdir -p "$TARGET_DIR"

copy_one() {
  src="$1"
  rel="$2"
  dest="$TARGET_DIR/$rel"
  if [ -e "$dest" ]; then
    echo "SKIP (already exists; not overwritten): $dest"
    return
  fi
  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  echo "INSTALLED: $dest"
}

copy_one "$SOURCE_DIR/server.js" "server.js"
copy_one "$SOURCE_DIR/generated_filters.js" "generated_filters.js"
copy_one "$SOURCE_DIR/package.json" "package.json"
copy_one "$SOURCE_DIR/README.md" "README.md"
copy_one "$SOURCE_DIR/GENERATED_FILTERS.md" "GENERATED_FILTERS.md"
mkdir -p "$TARGET_DIR/public"
for rel in index.html app.js style.css; do
  copy_one "$SOURCE_DIR/public/$rel" "public/$rel"
done
mkdir -p "$TARGET_DIR/public/assets"
for rel in prakashh-profile.jpg prakashh-signature.png; do
  copy_one "$SOURCE_DIR/public/assets/$rel" "public/assets/$rel"
done
mkdir -p "$TARGET_DIR/tests"
for rel in generated_filters.test.js security_flow.test.js; do
  copy_one "$SOURCE_DIR/tests/$rel" "tests/$rel"
done

echo
echo "DFOL files are in: $TARGET_DIR"
echo "Existing files were skipped, never overwritten. Use a new target folder to install this full version cleanly."
echo "Next:"
echo "  cd \"$TARGET_DIR\""
echo "  pkg install nodejs zip"
echo "  termux-setup-storage"
echo "  node server.js"
echo "Then open http://127.0.0.1:3001 in Android Chrome. Raw export authorization requires the visible Termux terminal for the 45-second code."
