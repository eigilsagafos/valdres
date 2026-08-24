---
name: before-pr
description: Pre-PR checklist for valdres — docs conventions, generated artifacts, and the checks CI will run. Use before creating or updating a PR, before pushing a branch for review, or after finishing a feature, plugin, or docs change.
---

# Before opening a PR

Walk every section. CI enforces the mechanical ones; the quality ones are on you.

## 1. Run what CI runs

```bash
bun run verify                            # ci.yaml's PR jobs, read from the workflow
bun run docs:build                        # must build clean (catches broken MDX)
bun run scripts/gen-readmes.ts --check    # READMEs in sync with MDX
```

`bun run verify` (~1m20s) runs both PR-gated jobs in `.github/workflows/ci.yaml`
— `test` and `valdres-package` — in CI's order, reading the steps out of the
workflow at run time: build, build:types, typecheck, the `@ts-ignore` ban,
architecture and retained-memory gates, the Node/V8 rewrite-guard lane, the
changeset check, the valdres-svelte publish lint, `bun test scripts/`, the
package test sweep, and the published-tarball gate. It omits only the publish
dry-run and its cleanup assertion. `bun run test` is a single one of those
steps; running it alone is what let PR #329 go red.

The two commands after it are the gap verify does not cover (`docs-ci.yml`) —
verify prints that reminder itself on every run. `--list` shows the plan,
`--from=N` resumes after a fix.

## 2. Documentation coverage

Did the change add or alter public API? Then docs must move with it:

- **Core API** → `packages/valdres/src/<name>.mdx` (fans out to `/react/<name>`, `/vue/<name>`, …).
- **Adapter API** → `packages/valdres-<fw>/src/<name>.mdx` → `/<fw>/<name>`, **plus** a role entry in `docs/src/framework-map.ts` so the framework switcher links equivalents across frameworks.
- **New `@valdres/*` plugin** → exactly one `packages/@valdres/<pkg>/src/<pkg>.mdx` (becomes `/<fw>/plugins/<pkg>` for all five frameworks). Per-framework examples via `<FrameworkBlock fw="...">`. Add an interactive demo: `<PluginDemo plugin="<pkg>" />` in the MDX + an entry in `docs/src/islands/plugins/registry.ts` — the `inspector()` helper (rows / gated / action / log / extra) covers most cases. Give the package.json a `description` (used by npm and the root README table).
- **Guides** → `docs/content/guides/*.mdx`; nav in `docs/content/nav.ts`.

Match an existing page for structure (e.g. `packages/@valdres/browser-online/src/browser-online.mdx`): install → live example → usage per framework → exports table → one-line cross-framework note.

## 3. Docs quality bar

- **Concise.** No filler, no praise words, no restating the obvious. Exports tables + code over prose. A page should be skimmable in under a minute.
- **Verified against source.** Never guess signatures or value shapes — open the implementation. Past bugs to not repeat: Angular's `injectValue` returns `ValueState<V>` (read `.value()`), not a `Signal`; `windowSizeAtom` is `{ innerWidth, innerHeight, … }`, not `{ width, height }`.
- **Truthful.** Perf claims are core-vs-Jotai only; adapters build on each framework's native reactivity and are never claimed faster than it. No unsourced numbers — measure or omit. Don't claim a pattern is "impossible elsewhere" when it's merely more boilerplate elsewhere.
- **Demos verified in a browser** when you add/change one — values must actually render and update (serve `docs/dist`, click through).

## 4. Generated files — never hand-edit

Regenerate instead; hand edits get clobbered or fail `--check`:

| File | Regenerate with |
|------|-----------------|
| `packages/**/README.md` (between `DOCS` markers) | `bun run gen-readmes` (edit the co-located MDX instead) |
| Root `README.md` `PACKAGES` table | `bun run gen-readmes` |
| Root `README.md` `BENCH` table | Bencher workflow (`scripts/gen-bench-table.ts`) |
| `docs/content/bench-summary.json` | `bun run scripts/gen-bench-summary.ts` |

Custom README prose is fine **outside** the markers.

## 5. PR hygiene

- Changeset committed (`bunx changeset`, or `--empty` for non-releasing changes).
- PR body reflects what the branch does now, not what it did when opened.
- If the branch is behind `main`: merge `origin/main`, resolve (package.json conflicts: keep descriptions, take main's versions), and re-run section 1.
