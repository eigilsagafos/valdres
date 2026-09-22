#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# One source of truth, shared with scripts/lib/publishable-packages.ts and the
# release build. `while read` rather than `mapfile` because macOS still ships
# bash 3.2 and `bun run verify` replays these steps locally.
PUBLIC_PACKAGES=()
while IFS= read -r package_dir; do
  [ -n "$package_dir" ] && PUBLIC_PACKAGES+=("$package_dir")
done < <(node -p "require('$ROOT_DIR/scripts/publishable-packages.json').join('\n')")

if [ "${#PUBLIC_PACKAGES[@]}" -eq 0 ]; then
  echo "::error::scripts/publishable-packages.json resolved to no packages"
  exit 1
fi

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

# Changesets owns the next prerelease counter. Feature branches keep the
# currently published versions; the generated Version Packages PR advances the
# manifests for every merged Changeset. Validate the release channel and fixed
# package cohort here without manually scheduling either version.
node - "$ROOT_DIR" "${PUBLIC_PACKAGES[@]}" <<'NODE'
const fs = require("node:fs")
const path = require("node:path")

const [rootDir, ...packageDirs] = process.argv.slice(2)
const preState = JSON.parse(
  fs.readFileSync(path.join(rootDir, ".changeset", "pre.json"), "utf8"),
)
const betaVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-beta\.(0|[1-9]\d*)$/

if (preState.mode !== "pre" || preState.tag !== "beta") {
  throw new Error("V1-beta publish validation requires Changesets beta prerelease mode")
}

for (const packageDir of packageDirs) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(rootDir, packageDir, "package.json"), "utf8"),
  )
  // Scope-aware: packages/valdres -> valdres, and
  // packages/@valdres/browser-contrast -> @valdres/browser-contrast. Plain
  // basename() silently expected "browser-contrast" and aborted the whole
  // release on the first scoped package.
  const base = path.basename(packageDir)
  const parent = path.basename(path.dirname(packageDir))
  const expectedName = parent.startsWith("@") ? `${parent}/${base}` : base
  if (manifest.name !== expectedName) {
    throw new Error(
      `Refusing to publish ${packageDir}: expected package name ${expectedName}, received ${manifest.name}`,
    )
  }

  if (typeof manifest.version !== "string" || !betaVersion.test(manifest.version)) {
    throw new Error(
      `Refusing to publish ${manifest.name}@${manifest.version}: expected a canonical x.y.z-beta.N version selected by Changesets`,
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
