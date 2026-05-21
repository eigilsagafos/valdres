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
| atom(1) | 🟢 7.3x faster | 🟢 1.9x faster |
| store.get(atom) | 🟢 27.0x faster | 🟢 6.9x faster |
| set(atom, value) | 🟢 14.0x faster | 🟢 3.0x faster |
| set(atom, curr => curr+1) | 🟢 15.1x faster | 🟢 5.2x faster |
| set(atom) with 10 subs | 🟢 15.6x faster | 🟢 3.5x faster |
| atom lifecycle (create+100get+100set) | 🟢 16.4x faster | 🟢 4.5x faster |
| set 1000 atoms | 🟢 8.8x faster | 🟢 5.2x faster |
| get 1000 atoms | 🟢 39.7x faster | 🟢 13.4x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 10.8x faster | 🟢 1.4x faster |
| set + read 10 selectors | 🟢 4.4x faster | 🟢 1.7x faster |
| set + read 100 selectors | 🟢 3.3x faster | 🟢 1.6x faster |
| set + read through 5 chained selectors | 🟢 2.0x faster | 🟢 1.6x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 3.9x faster | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.9x faster | 🟢 2.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 3.0x faster | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 3.6x faster | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 16.7x faster | 🟢 9.8x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 2.3x slower | 🟡 1.9x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.4x faster | 🟢 1.4x faster |
| selectorFamily(id) | 🟢 1.3x faster | 🟢 1.4x faster |
| createStore | 🟢 24.5x faster | 🟢 3.3x faster |
| sub + unsub | 🟢 3.2x faster | 🟢 1.8x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-05-21 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
