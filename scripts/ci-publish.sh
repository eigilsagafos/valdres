#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

PUBLIC_PACKAGES=(
  packages/valdres
  packages/valdres-react
)

# Restore prepacked package.json files even if the script aborts midway.
restore_packages() {
  local restore_failed=0

  for dir in "${PUBLIC_PACKAGES[@]}"; do
    # A package only needs restoring once prepack has created its backup. This
    # lets an early prepack failure clean up the packages already visited
    # without treating untouched packages as restore failures.
    if [ ! -f "$ROOT_DIR/$dir/package.tmp.json" ]; then
      continue
    fi

    if ! (cd "$ROOT_DIR/$dir" && bun run "$SCRIPT_DIR/postpublish.ts"); then
      echo "::error file=$dir/package.json::Failed to restore $dir/package.json after publish prepack"
      restore_failed=1
    fi
  done

  return "$restore_failed"
}

restore_on_exit() {
  local exit_code=$?
  trap - EXIT

  # A restore failure is fatal even if a live `changeset publish` succeeded.
  # Publishing may already have changed npm, but leaving CI red makes that
  # partial release explicit so it can be reconciled before another release.
  if ! restore_packages; then
    exit_code=1
  fi

  exit "$exit_code"
}
trap restore_on_exit EXIT

# Sanity-check that `bunx changeset` resolves before doing any work — catches
# missing-binary regressions on PR before they reach the real publish flow.
bunx changeset --help > /dev/null

# The feature PR temporarily seeds both manifests at 1.0.0 so a minor
# Changeset starts an isolated 1.1.0-beta.0 line. changesets/action consumes
# that Changeset into a release PR before it invokes this script. Refuse a live
# manual publish of the seed (or any later stable version) while prerelease mode
# is active. DRY_RUN still exercises prepack/restore on the feature PR.
if [ "${DRY_RUN:-0}" != "1" ]; then
  node - "$ROOT_DIR" "${PUBLIC_PACKAGES[@]}" <<'NODE'
const fs = require("node:fs")
const path = require("node:path")

const [rootDir, ...packageDirs] = process.argv.slice(2)
const preState = JSON.parse(
  fs.readFileSync(path.join(rootDir, ".changeset", "pre.json"), "utf8"),
)

if (preState.mode !== "pre" || preState.tag !== "beta") {
  throw new Error("Live v1-beta publish requires Changesets beta prerelease mode")
}

for (const packageDir of packageDirs) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(rootDir, packageDir, "package.json"), "utf8"),
  )
  if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(manifest.version)) {
    throw new Error(
      `Refusing to publish ${manifest.name}@${manifest.version}: certified packages must use an x.y.z-beta.N version`,
    )
  }
}
NODE
fi

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
