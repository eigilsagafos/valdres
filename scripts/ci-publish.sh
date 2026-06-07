#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

PUBLIC_PACKAGES=(
  packages/valdres
  packages/valdres-react
  packages/valdres-angular
  packages/valdres-solid
  packages/valdres-svelte
  packages/valdres-vue
  packages/@valdres/bandwidth
  packages/@valdres/browser-color-scheme
  packages/@valdres/browser-contrast
  packages/@valdres/browser-device-motion
  packages/@valdres/browser-device-orientation
  packages/@valdres/browser-focus
  packages/@valdres/browser-geolocation
  packages/@valdres/browser-keyboard
  packages/@valdres/browser-online
  packages/@valdres/browser-presence
  packages/@valdres/browser-reduced-data
  packages/@valdres/browser-reduced-motion
  packages/@valdres/browser-reduced-transparency
  packages/@valdres/browser-screen
  packages/@valdres/browser-screen-details
  packages/@valdres/browser-visibility
  packages/@valdres/browser-window
  packages/@valdres/color-mode
  packages/@valdres/hotkeys
  packages/@valdres/public-ip
  packages/@valdres/redux-devtools
  packages/@valdres-react/color-mode
  packages/@valdres-react/draggable
  packages/@valdres-react/hotkeys
  packages/@valdres-react/jotai
  packages/@valdres-react/panable
  packages/@valdres-react/recoil
)

# Restore prepacked package.json files even if the script aborts midway.
restore_packages() {
  for dir in "${PUBLIC_PACKAGES[@]}"; do
    (cd "$ROOT_DIR/$dir" && bun run "$SCRIPT_DIR/postpublish.ts" 2>/dev/null) || true
  done
}
trap restore_packages EXIT

# Sanity-check that `bunx changeset` resolves before doing any work — catches
# missing-binary regressions on PR before they reach the real publish flow.
bunx changeset --help > /dev/null

# Prepack all public packages (rewrite package.json exports for dist)
for dir in "${PUBLIC_PACKAGES[@]}"; do
  echo "Prepacking $dir..."
  (cd "$ROOT_DIR/$dir" && bun run "$SCRIPT_DIR/prepack.ts")
done

# DRY_RUN=1 skips the actual publish but still exercises bunx + changeset
# resolution and prepack/postpublish so PRs catch orchestration bugs.
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "DRY_RUN=1: skipping 'changeset publish'"
else
  bunx changeset publish
fi
