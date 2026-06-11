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

The docs site is the repo-root `docs/` custom static build (`bun run docs:build` / `docs:dev`, served at `localhost:4321`). Source of truth is co-located MDX; almost everything else is generated.

**Where docs live:**
- Core APIs: `packages/valdres/src/<name>.mdx` — fans out to `/react/<name>`, `/vue/<name>`, etc.
- Adapter APIs: `packages/valdres-<fw>/src/<name>.mdx` → `/<fw>/<name>`. New adapter APIs also need a role entry in `docs/src/framework-map.ts` so the framework switcher links equivalents.
- Plugins: exactly one `packages/@valdres/<pkg>/src/<pkg>.mdx` → `/<fw>/plugins/<pkg>` for all five frameworks. Per-framework examples use `<FrameworkBlock fw="react">…</FrameworkBlock>`; add an interactive demo via `<PluginDemo plugin="<pkg>" />` + an entry in `docs/src/islands/plugins/registry.ts` (the `inspector()` helper covers most cases).
- Guides: `docs/content/guides/*.mdx`, nav in `docs/content/nav.ts`.

**Rules:**
- **Concise.** No filler, no praise words, no restating the obvious. Prefer exports tables + code over prose. Match an existing plugin page (e.g. `browser-online.mdx`) for structure and length.
- **Verify against source.** Never guess signatures or value shapes — read the implementation (e.g. Angular's `injectValue` returns `ValueState<V>` read via `.value()`, not a Signal; `windowSizeAtom` is `{innerWidth,…}` not `{width,…}`).
- **Truthful positioning.** Perf claims are core-vs-Jotai only; adapters build on each framework's native reactivity and are never claimed faster than it. No unsourced numbers — measure or omit.
- **Don't hand-edit generated content:** package `README.md`s and the root README's `PACKAGES` table (`bun run gen-readmes`, regenerated from the MDX — edit the MDX instead; custom prose goes outside the `DOCS`/`PACKAGES` markers), the README `BENCH` table, and `docs/content/bench-summary.json` (both from Bencher workflows).
- CI runs `docs:build` + `gen-readmes --check` on every PR — broken MDX or README drift fails the build.

## Benchmarks

- Benchmarks live in `packages/valdres/test/performance/*.bench.ts` (mitata via the `compare` / `measureOne` helpers in `bench-utils.ts`) and report to [Bencher](https://bencher.dev/perf/valdres) through `.github/workflows/bencher-{base,pr}.yml`. Bencher gates PRs on per-benchmark `latency` regressions vs `main`; the hosted perf page is the source of truth. The README's `BENCH` table and `docs/content/bench-summary.json` are committed snapshots auto-refreshed from Bencher — don't hand-edit.
- New perf work needs head-to-head comparisons against the relevant competitor (Jotai for core, Recoil/MiniSearch/etc. where applicable), not isolated numbers.
