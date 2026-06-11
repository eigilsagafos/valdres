# Valdres — agent notes

## Runtime

Bun, not Node. Use `bun test`, `bun run <script>`, `bun --filter '*' <script>` for all packages. Don't reach for `npm`, `pnpm`, `vitest`, or `jest`.

## Monorepo layout

- `packages/valdres` — core (atoms, selectors, store).
- `packages/@valdres/{feature}` — framework-agnostic feature packages. Most wrap a browser API.
- `packages/@valdres-react/{feature}` — React bindings. **Only some features have one** — don't add a React binding by default.
- `packages/valdres-{react,vue,solid,svelte,angular}` — framework adapters for the core.

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

- **One export per file.** `index.ts` is purely re-exports.
- `lib/` is internal; `utils/` is public. Put helpers in the right one.

## Browser-API package pattern

Each `@valdres/browser-*` package wraps one browser API as global atoms. Canonical reference: `packages/@valdres/browser-geolocation`.

- Atoms use `{ global: true, name: "@valdres/<pkg>/<atom>", onMount: () => bootstrap(thisAtom) }`.
- `onMount` starts the browser subscription on first subscriber; the cleanup it returns stops it when the last subscriber leaves.
- Subscription wiring lives in `lib/bootstrap.ts` (and friends like `lib/subscribePermission.ts`).

## Tests

- `bun test` per package. Files colocated as `*.test.ts` next to source.
- Happy-DOM is preloaded via each package's `bunfig.toml` (`preload = "./test/setup/happyDom.ts"`). Don't add jsdom.

## Releasing

Changesets. Any PR touching a publishable package needs `bunx changeset` committed alongside it — CI enforces this via `bunx changeset status --since=origin/main`. For PRs that change publishable code but intentionally don't release (refactors, internal cleanup), run `bunx changeset --empty` to satisfy the check. Don't hand-edit `version` fields or CHANGELOGs — the Version Packages bot does that on merge. Repo is in `beta` prerelease mode.

## Documentation

- Docs site = repo-root `docs/` custom build (`bun run docs:dev` at `localhost:4321`). Source of truth is co-located MDX next to the code it documents.
- **Don't hand-edit generated files**: package `README.md`s, the root README's `PACKAGES`/`BENCH` tables, and `docs/content/bench-summary.json` are regenerated (`bun run gen-readmes` / Bencher workflows) — edit the MDX instead.
- **Before opening or updating a PR, run the `/before-pr` skill** — it has the full checklist: docs coverage, quality bar, generated artifacts, and the checks CI enforces (`docs:build` + `gen-readmes --check` run on PRs that touch docs-related files).

## Benchmarks

- Benchmarks live in `packages/valdres/test/performance/*.bench.ts` (mitata via the `compare` / `measureOne` helpers in `bench-utils.ts`) and report to [Bencher](https://bencher.dev/perf/valdres) through `.github/workflows/bencher-{base,pr}.yml`. Bencher gates PRs on per-benchmark `latency` regressions vs `main`; the hosted perf page is the source of truth. The README's `BENCH` table and `docs/content/bench-summary.json` are committed snapshots auto-refreshed from Bencher — don't hand-edit.
- New perf work needs head-to-head comparisons against the relevant competitor (Jotai for core, Recoil/MiniSearch/etc. where applicable), not isolated numbers.
