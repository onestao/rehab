#!/bin/sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="$ROOT/.git-hooks"
TARGET_DIR="$ROOT/.git/hooks"

if [ ! -d "$ROOT/.git" ]; then
  echo "Not a git repository: $ROOT" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp "$HOOKS_DIR/pre-push" "$TARGET_DIR/pre-push"
chmod +x "$TARGET_DIR/pre-push"

echo "Installed pre-push hook: $TARGET_DIR/pre-push"
