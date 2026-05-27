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

For PRs that touch publishable code but intentionally don't trigger a release (refactors, internal cleanup, docs):

```bash
bunx changeset --empty
```

This still generates a `.changeset/*.md` file — commit it like a regular changeset. The `Require changeset` check on each PR enforces that any change to a publishable package ships with a changeset (empty or otherwise).

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
| atom(1) | 🟢 9.6x faster | 🟢 1.7x faster |
| store.get(atom) | 🟢 27.9x faster | 🟢 10.9x faster |
| set(atom, value) | 🟢 19.0x faster | 🟢 5.7x faster |
| set(atom, curr => curr+1) | 🟢 26.8x faster | 🟢 6.4x faster |
| set(atom) with 10 subs | 🟢 21.5x faster | 🟢 6.7x faster |
| atom lifecycle (create+100get+100set) | 🟢 22.9x faster | 🟢 5.8x faster |
| set 1000 atoms | 🟢 8.8x faster | 🟢 6.0x faster |
| get 1000 atoms | 🟢 46.1x faster | 🟢 13.1x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 7.9x faster | 🟢 1.3x faster |
| set + read 10 selectors | 🟢 3.9x faster | 🟢 2.0x faster |
| set + read 100 selectors | 🟢 5.1x faster | 🟢 1.8x faster |
| set + read 100 selectorFamily entries | 🟢 4.7x faster | 🟢 1.7x faster |
| set + read through 5 chained selectors | 🟢 2.0x faster | 🟢 1.7x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 3.4x faster | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.0x faster | 🟢 2.6x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 3.5x faster | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 3.8x faster | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 11.1x faster | 🟢 8.1x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 2.5x slower | 🔴 3.1x slower |

#### Other

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 🟢 1.2x faster | 🟡 1.6x slower |
| sub+unsub on chain of 100 unsubscribed derived deps | 🟢 1.2x faster | 🟡 1.6x slower |
| sub+unsub on chain of 500 unsubscribed derived deps | 🟢 1.2x faster | 🟡 1.5x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.4x faster | 🟢 1.5x faster |
| selectorFamily(id) | 🟢 1.1x faster | 🟢 1.2x faster |
| createStore | 🟢 18.0x faster | 🟢 2.5x faster |
| sub + unsub | 🟢 3.0x faster | 🟢 1.6x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-05-27 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
