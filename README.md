# Valdres

```bash
bun install
```

## Releasing

Versioning and publishing is handled by [Changesets](https://github.com/changesets/changesets). Each package versions independently.

**When you open a PR that changes a publishable package:**

```bash
bunx changeset
```

Pick the affected packages, the bump type (patch/minor/major), and write a short summary. Commit the generated `.changeset/*.md` file with your PR.

When the PR merges to `main`, the `Publish` workflow opens (or updates) a **Version Packages** PR that applies the pending changesets, bumps versions, and updates CHANGELOGs. Merging that PR publishes the affected packages to npm.

To preview what publishing would do locally:

```bash
bun run verify-publish
```

The repo is currently in `beta` prerelease mode (`bunx changeset pre exit` to graduate to stable).

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0 on the same CI runner using Bun (JavaScriptCore / Safari) and Node.js (V8 / Chrome).

#### Atoms

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atom(1) | 🟢 21.0x faster | 🟢 2.0x faster |
| store.get(atom) | 🟢 9.3x faster | 🟢 12.6x faster |
| set(atom, value) | 🟢 12.0x faster | 🟢 4.6x faster |
| set(atom, curr => curr+1) | 🟢 17.7x faster | 🟢 5.4x faster |
| set(atom) with 10 subs | 🟢 18.5x faster | 🟢 5.3x faster |
| atom lifecycle (create+100get+100set) | 🟢 17.4x faster | 🟢 4.4x faster |
| set 1000 atoms | 🟢 16.2x faster | 🟢 5.7x faster |
| get 1000 atoms | 🟢 53.3x faster | 🟢 13.9x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 11.6x faster | 🟢 1.3x faster |
| set + read 10 selectors | 🟢 3.5x faster | 🟢 2.2x faster |
| set + read 100 selectors | 🟢 3.2x faster | 🟢 1.7x faster |
| set + read through 5 chained selectors | 🟢 2.3x faster | 🟢 2.0x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 3.8x faster | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.3x faster | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 4.2x faster | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 4.0x faster | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 14.4x faster | 🟢 12.1x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 2.5x slower | 🔴 4.2x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.5x faster | 🟢 1.1x faster |
| selectorFamily(id) | 🟢 1.4x faster | 🟢 1.1x faster |
| createStore | 🟢 10.7x faster | 🟢 7.5x faster |
| sub + unsub | 🟢 4.6x faster | 🟢 2.5x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-28 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
