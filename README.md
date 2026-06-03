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

### Performance

valdres is benchmarked against [Jotai](https://github.com/pmndrs/jotai) (and a raw `Map` floor) on every PR via [Bencher](https://bencher.dev) — live, always-current latency per operation under both Bun (JavaScriptCore) and Node.js (V8):

**→ [bencher.dev/perf/valdres](https://bencher.dev/perf/valdres)**

Every PR from the repo gets a comment flagging any latency regression vs `main` (fork PRs are skipped — they can't read the upload key).

<!-- BENCH:START -->
### Performance vs Jotai

Latest `main` latency per operation (live, always-current numbers: [bencher.dev/perf/valdres](https://bencher.dev/perf/valdres)). Auto-generated from Bencher — do not hand-edit.

#### Bun (JavaScriptCore)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 12.0µs | 267.0µs | 🟢 22.2× faster |
| `atom(1)` | 2ns | 55ns | 🟢 22.0× faster |
| `atomFamily(id)` | 245ns | 457ns | 🟢 1.9× faster |
| `atomFamily(id) cache hit` | 29ns | 12ns | 🔴 2.5× slower |
| `createStore` | 259ns | 5.4µs | 🟢 21.0× faster |
| `get 1000 atoms` | 9.4µs | 632.4µs | 🟢 66.9× faster |
| `selector(fn)` | 4ns | 58ns | 🟢 13.4× faster |
| `selectorFamily(id)` | 186ns | 439ns | 🟢 2.4× faster |
| `set + read 10 selectors` | 6.7µs | 37.2µs | 🟢 5.6× faster |
| `set + read 100 selectorFamily entries` | 71.3µs | 274.8µs | 🟢 3.9× faster |
| `set + read 100 selectors` | 55.6µs | 355.5µs | 🟢 6.4× faster |
| `set + read through 5 chained selectors` | 5.7µs | 18.5µs | 🟢 3.2× faster |
| `set 1000 atoms` | 107.2µs | 964.2µs | 🟢 9.0× faster |
| `set(atom, curr => curr+1)` | 97ns | 3.1µs | 🟢 32.5× faster |
| `set(atom, value)` | 114ns | 2.4µs | 🟢 21.3× faster |
| `set(atom) with 10 subs` | 142ns | 3.9µs | 🟢 27.5× faster |
| `store.get(atom)` | 40ns | 371ns | 🟢 9.3× faster |
| `sub + unsub` | 450ns | 3.3µs | 🟢 7.3× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 104.7µs | 139.8µs | 🟢 1.3× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 64.4µs | 98.0µs | 🟢 1.5× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 474.7µs | 654.9µs | 🟢 1.4× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 67.2µs | 292.6µs | 🟢 4.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 108.8µs | 603.0µs | 🟢 5.5× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 663.4µs | 2.77ms | 🟢 4.2× faster |
| `txn: asymmetric DAG shared sink` | 26.2µs | 155.6µs | 🟢 5.9× faster |
| `txn: cross-atom 1000 selectors, set + read` | 745.9µs | 5.32ms | 🟢 7.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.27ms | 23.18ms | 🟢 18.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.32ms | 20.99ms | 🟢 4.9× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 27.1µs | 145.4µs | 🟢 5.4× faster |
| `atom(1)` | 25ns | 49ns | 🟢 1.9× faster |
| `atomFamily(id)` | 242ns | 406ns | 🟢 1.7× faster |
| `atomFamily(id) cache hit` | 28ns | 27ns | 🔴 1.1× slower |
| `createStore` | 175ns | 1.7µs | 🟢 9.9× faster |
| `get 1000 atoms` | 15.0µs | 206.1µs | 🟢 13.8× faster |
| `selector(fn)` | 42ns | 54ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 183ns | 258ns | 🟢 1.4× faster |
| `set + read 10 selectors` | 8.3µs | 21.4µs | 🟢 2.6× faster |
| `set + read 100 selectorFamily entries` | 74.4µs | 131.1µs | 🟢 1.8× faster |
| `set + read 100 selectors` | 71.3µs | 131.2µs | 🟢 1.8× faster |
| `set + read through 5 chained selectors` | 5.4µs | 10.0µs | 🟢 1.9× faster |
| `set 1000 atoms` | 81.6µs | 447.5µs | 🟢 5.5× faster |
| `set(atom, curr => curr+1)` | 236ns | 1.5µs | 🟢 6.5× faster |
| `set(atom, value)` | 221ns | 1.3µs | 🟢 5.8× faster |
| `set(atom) with 10 subs` | 261ns | 1.7µs | 🟢 6.7× faster |
| `store.get(atom)` | 14ns | 160ns | 🟢 11.8× faster |
| `sub + unsub` | 880ns | 2.1µs | 🟢 2.4× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 167.8µs | 107.8µs | 🔴 1.6× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 91.5µs | 56.6µs | 🔴 1.6× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 766.0µs | 534.2µs | 🔴 1.4× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 74.2µs | 151.9µs | 🟢 2.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 80.6µs | 248.4µs | 🟢 3.1× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 823.1µs | 1.35ms | 🟢 1.6× faster |
| `txn: asymmetric DAG shared sink` | 24.0µs | 55.3µs | 🟢 2.3× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.03ms | 1.81ms | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.05ms | 13.20ms | 🟢 12.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.89ms | 9.40ms | 🟢 2.4× faster |

<!-- BENCH:END -->
