# Valdres — agent notes

## Runtime

Bun, not Node. Don't reach for `npm`, `pnpm`, `vitest`, or `jest`.

- Run tests **per-package** (`cd packages/<pkg> && bun test`), run the certified
  v1 core + React cohort via `bun run test`, or run every package via
  `bun run test:all`.
- **Never run bare `bun test` at the repo root.** The built-in runner scans
  every package from the wrong cwd and fabricates ~240 bogus failures; a bunfig
  `[test].preload` guard now hard-fails it with instructions.
- Fresh checkouts have no `node_modules` — run `bun install` first (Conductor
  workspaces do this automatically via `.conductor/settings.toml`).

## Monorepo layout

- `packages/valdres` — core (atoms, selectors, store).
- `packages/@valdres/{feature}` — framework-agnostic feature packages. Most wrap
  a browser API.
- `packages/@valdres-react/{feature}` — React bindings. **Only some features
  have one** — don't add a React binding by default.
- `packages/valdres-{react,vue,solid,svelte,angular}` — framework adapters for
  the core.

## Package internals

```
src/
  atoms/        one atom per file
  selectors/    one selector per file
  lib/          internal helpers (not exported)
  utils/        public helpers (re-exported via index.ts)
  index.ts      re-exports only
types/          shared types live here, NOT in src/
test/
```

- **One export per public file.** Internal `lib/` modules may group cohesive
  exports. The re-export-only `index.ts` barrel is the intentional exception to
  the one-export guard.
- `lib/` is internal; `utils/` is public. Put helpers in the right one.

## Browser-API package pattern

Each `@valdres/browser-*` package wraps one browser API as global atoms.
Canonical reference: `packages/@valdres/browser-geolocation`.

- Atoms use
  `globalAtom(defaultValue, { name: "@valdres/<pkg>/<atom>", onMount: () => bootstrap(thisAtom) })`.
- `onMount` starts the browser subscription on first subscriber; the cleanup it
  returns stops it when the last subscriber leaves.
- Subscription wiring lives in `lib/bootstrap.ts` (and friends like
  `lib/subscribePermission.ts`).

## Tests

- `bun test` per package. Files colocated as `*.test.ts` next to source.
- Happy-DOM is preloaded via each package's `bunfig.toml`
  (`preload = "./test/setup/happyDom.ts"`). Don't add jsdom.
- **`bun run test` is only the certified core + React package-test step, not the
  full CI gate.** CI also runs the v1 contracts and migration ledger, certified
  builds and typechecks, the packed ShiftX workload, focused v1 model/evaluator/
  StoreTree contracts, release-infrastructure tests, generated-README drift,
  JUnit coverage, the published-core artifact gate, and the packed core + React
  consumer matrix. Use `bun run test:all` only for the deferred full-monorepo
  maintenance lane.
- **`bun run verify` is the pre-PR command** (~1m20s). It reads the step list
  out of `.github/workflows/ci.yaml` at run time (not a hand-copied duplicate)
  and runs both PR-gated jobs — `test` and `valdres-package` — in CI's order,
  omitting only the publish dry-run and its cleanup assertion, since the dry-run
  executes the real release script against your working tree. It does **not**
  cover the manual-only legacy docs-site build or the Bencher gate; it prints
  that list on every run. `--list` prints the plan without running it;
  `--from=N` resumes after a fix (and says so instead of claiming a full pass).
- **verify refuses to run on a toolchain that doesn't match CI's pins.** Keep
  local Bun at `.bun-version` and Node at ci.yaml's `node-version` — bundler
  output is Bun-specific and the size gate runs inside verify, so the wrong
  version measures something other than what CI measures. `--list` needs no
  toolchain; `--allow-toolchain-drift` overrides and downgrades the final claim.

## Releasing

Changesets. Any PR touching a publishable package needs `bunx changeset`
committed alongside it — CI enforces this via
`bunx changeset status --since=origin/main`. For PRs that change publishable
code but intentionally don't release (refactors, internal cleanup), run
`bunx changeset --empty` to satisfy the check. Don't hand-edit `version` fields
or CHANGELOGs — the Version Packages bot does that on merge. Repo is in `beta`
prerelease mode.

## Documentation

- Docs site = repo-root `docs/` custom build (`bun run docs:dev` at
  `localhost:4321`). Source of truth is co-located MDX next to the code it
  documents.
- **Don't hand-edit generated files**: package `README.md`s, the root README's
  `PACKAGES`/`BENCH` tables, and `docs/content/bench-summary.json` are
  regenerated (`bun run gen-readmes` / Bencher workflows) — edit the MDX
  instead.
- **Before opening or updating a PR, run `bun run verify` and the `/before-pr`
  skill** — `verify` is ci.yaml's PR jobs, including generated README drift; the
  skill adds the remaining docs-coverage, quality, and artifact review. The
  legacy docs-site build is manual-only while the core+React v1 beta ships.

## Benchmarks

- Benchmarks live in `packages/valdres/test/performance/*.bench.ts` (mitata via
  the `compare` / `measureOne` helpers in `bench-utils.ts`) and report to
  [Bencher](https://bencher.dev/perf/valdres) through
  `.github/workflows/bencher-{base,pr}.yml`. PRs use a fast same-runner relative
  `latency` gate; `.github/workflows/bencher-deep.yml` runs weekly/manual
  report-only statistical calibration without Bencher access; `main` tracks
  median-of-three raw latency plus a pinned-Jotai runner-normalized measure for
  cumulative regressions. The hosted perf page is the source of truth. The
  README's `BENCH` table and `docs/content/bench-summary.json` are committed
  snapshots auto-refreshed from Bencher — don't hand-edit.
- New perf work needs head-to-head comparisons against the relevant competitor
  (Jotai for core, Recoil/MiniSearch/etc. where applicable), not isolated
  numbers.
