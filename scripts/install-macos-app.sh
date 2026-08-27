#!/bin/zsh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILT_APP="/private/tmp/brainmax-native-build/Brainmax.app"
ROLLBACK_APP="/private/tmp/brainmax-native-build/Brainmax.rollback.app"
INSTALLING_APP="/Applications/.Brainmax.installing.app"
INSTALLED_APP="/Applications/Brainmax.app"

refuse_unexpected_path() {
  local actual="$1"
  local expected="$2"
  if [[ "$actual" != "$expected" ]]; then
    echo "Refusing to modify an unexpected app path: $actual" >&2
    exit 1
  fi
}

remove_generated_bundle() {
  local target="$1"
  local expected="$2"
  refuse_unexpected_path "$target" "$expected"
  if [[ -e "$target" || -L "$target" ]]; then
    if [[ ! -d "$target" || -L "$target" ]]; then
      echo "Refusing to replace a non-directory or symlink: $target" >&2
      exit 1
    fi
    rm -rf -- "$target"
  fi
}

restore_previous_app() {
  if [[ -d "$ROLLBACK_APP" && ! -e "$INSTALLED_APP" ]]; then
    echo "Restoring the previous Brainmax app after an install failure." >&2
    mv "$ROLLBACK_APP" "$INSTALLED_APP"
  fi
}

cleanup() {
  if [[ -d "$INSTALLING_APP" && ! -L "$INSTALLING_APP" ]]; then
    rm -rf -- "$INSTALLING_APP"
  fi
  restore_previous_app
}

trap cleanup EXIT

"$PROJECT_DIR/scripts/build-macos-app.sh"

if [[ ! -d "$BUILT_APP" || -L "$BUILT_APP" ]]; then
  echo "The generated Brainmax app was not found at $BUILT_APP" >&2
  exit 1
fi

remove_generated_bundle "$INSTALLING_APP" "/Applications/.Brainmax.installing.app"
remove_generated_bundle "$ROLLBACK_APP" "/private/tmp/brainmax-native-build/Brainmax.rollback.app"

ditto "$BUILT_APP" "$INSTALLING_APP"
codesign --verify --deep --strict "$INSTALLING_APP"

if pgrep -x Brainmax >/dev/null 2>&1; then
  echo "Closing the currently running Brainmax app…"
  osascript -e 'tell application id "com.brainmax.training" to quit' >/dev/null 2>&1 || true
  for _ in {1..20}; do
    if ! pgrep -x Brainmax >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done
  if pgrep -x Brainmax >/dev/null 2>&1; then
    echo "Brainmax is still running. Quit it and run npm run mac again." >&2
    exit 1
  fi
fi

if [[ -e "$INSTALLED_APP" || -L "$INSTALLED_APP" ]]; then
  if [[ ! -d "$INSTALLED_APP" || -L "$INSTALLED_APP" ]]; then
    echo "Refusing to replace a non-directory or symlink: $INSTALLED_APP" >&2
    exit 1
  fi
  mv "$INSTALLED_APP" "$ROLLBACK_APP"
fi

mv "$INSTALLING_APP" "$INSTALLED_APP"
codesign --verify --deep --strict "$INSTALLED_APP"

remove_generated_bundle "$ROLLBACK_APP" "/private/tmp/brainmax-native-build/Brainmax.rollback.app"
trap - EXIT

open "$INSTALLED_APP"
echo "Installed and opened $INSTALLED_APP"
