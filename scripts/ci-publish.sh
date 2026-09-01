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

# The feature PR keeps each manifest at its currently published prerelease.
# Changesets advances package-local counters independently: this core-only
# Changeset moves valdres beta.25 to beta.26 while React remains at beta.5.
# changesets/action consumes the pending Changeset into a release PR before it
# invokes this script. Every dry run validates either the authored predecessor
# tuple or the exact target tuple; a live publish accepts only the target.
node - "$ROOT_DIR" "${DRY_RUN:-0}" "${PUBLIC_PACKAGES[@]}" <<'NODE'
const fs = require("node:fs")
const path = require("node:path")

const [rootDir, dryRunValue, ...packageDirs] = process.argv.slice(2)
const dryRun = dryRunValue === "1"
const expectedVersions = new Map([
  ["valdres", "1.0.0-beta.26"],
  ["valdres-react", "1.0.0-beta.5"],
])
const predecessorVersions = new Map([
  ["valdres", "1.0.0-beta.25"],
  ["valdres-react", "1.0.0-beta.5"],
])
const preState = JSON.parse(
  fs.readFileSync(path.join(rootDir, ".changeset", "pre.json"), "utf8"),
)

if (preState.mode !== "pre" || preState.tag !== "beta") {
  throw new Error("V1-beta publish validation requires Changesets beta prerelease mode")
}

for (const packageDir of packageDirs) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(rootDir, packageDir, "package.json"), "utf8"),
  )
  const expectedVersion = expectedVersions.get(manifest.name)
  const predecessorVersion = predecessorVersions.get(manifest.name)
  const versionIsAllowed =
    manifest.version === expectedVersion ||
    (dryRun && manifest.version === predecessorVersion)
  if (expectedVersion === undefined || !versionIsAllowed) {
    throw new Error(
      `Refusing to publish ${manifest.name}@${manifest.version}: expected ${expectedVersion ?? "a certified package"}${dryRun && predecessorVersion ? ` (or ${predecessorVersion} in DRY_RUN)` : ""}`,
    )
  }

  if (
    manifest.name === "valdres-react" &&
    manifest.peerDependencies?.valdres !== "^1.0.0-beta.24"
  ) {
    throw new Error(
      `Refusing to publish valdres-react with core peer ${manifest.peerDependencies?.valdres}: expected ^1.0.0-beta.24`,
    )
  }
}
NODE

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
