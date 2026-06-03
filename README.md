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
| `atom lifecycle (create+100get+100set)` | 11.8µs | 259.2µs | 🟢 21.9× faster |
| `atom(1)` | 2ns | 54ns | 🟢 21.8× faster |
| `atomFamily(id)` | 234ns | 390ns | 🟢 1.7× faster |
| `atomFamily(id) cache hit` | 29ns | 11ns | 🔴 2.6× slower |
| `createStore` | 256ns | 5.5µs | 🟢 21.5× faster |
| `get 1000 atoms` | 9.6µs | 629.3µs | 🟢 65.5× faster |
| `selector(fn)` | 4ns | 57ns | 🟢 14.4× faster |
| `selectorFamily(id)` | 195ns | 377ns | 🟢 1.9× faster |
| `set + read 10 selectors` | 6.6µs | 37.5µs | 🟢 5.7× faster |
| `set + read 100 selectorFamily entries` | 79.4µs | 271.8µs | 🟢 3.4× faster |
| `set + read 100 selectors` | 55.7µs | 349.5µs | 🟢 6.3× faster |
| `set + read through 5 chained selectors` | 5.7µs | 16.9µs | 🟢 3.0× faster |
| `set 1000 atoms` | 110.6µs | 964.6µs | 🟢 8.7× faster |
| `set(atom, curr => curr+1)` | 97ns | 3.1µs | 🟢 31.6× faster |
| `set(atom, value)` | 119ns | 3.1µs | 🟢 26.1× faster |
| `set(atom) with 10 subs` | 141ns | 4.2µs | 🟢 29.4× faster |
| `store.get(atom)` | 31ns | 371ns | 🟢 12.0× faster |
| `sub + unsub` | 413ns | 3.6µs | 🟢 8.8× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 107.2µs | 137.4µs | 🟢 1.3× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 64.6µs | 99.4µs | 🟢 1.5× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 504.2µs | 651.0µs | 🟢 1.3× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 66.4µs | 282.5µs | 🟢 4.3× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 104.9µs | 597.9µs | 🟢 5.7× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 682.5µs | 2.94ms | 🟢 4.3× faster |
| `txn: asymmetric DAG shared sink` | 26.3µs | 154.6µs | 🟢 5.9× faster |
| `txn: cross-atom 1000 selectors, set + read` | 740.4µs | 5.30ms | 🟢 7.2× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.36ms | 22.51ms | 🟢 16.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 5.00ms | 20.67ms | 🟢 4.1× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 25.2µs | 140.8µs | 🟢 5.6× faster |
| `atom(1)` | 26ns | 49ns | 🟢 1.9× faster |
| `atomFamily(id)` | 234ns | 381ns | 🟢 1.6× faster |
| `atomFamily(id) cache hit` | 25ns | 25ns | 🔴 1.0× slower |
| `createStore` | 269ns | 2.0µs | 🟢 7.3× faster |
| `get 1000 atoms` | 15.0µs | 216.3µs | 🟢 14.4× faster |
| `selector(fn)` | 42ns | 58ns | 🟢 1.4× faster |
| `selectorFamily(id)` | 192ns | 240ns | 🟢 1.2× faster |
| `set + read 10 selectors` | 8.3µs | 22.3µs | 🟢 2.7× faster |
| `set + read 100 selectorFamily entries` | 74.2µs | 136.6µs | 🟢 1.8× faster |
| `set + read 100 selectors` | 72.6µs | 133.7µs | 🟢 1.8× faster |
| `set + read through 5 chained selectors` | 5.2µs | 9.3µs | 🟢 1.8× faster |
| `set 1000 atoms` | 81.1µs | 457.2µs | 🟢 5.6× faster |
| `set(atom, curr => curr+1)` | 211ns | 1.5µs | 🟢 7.1× faster |
| `set(atom, value)` | 212ns | 1.2µs | 🟢 5.9× faster |
| `set(atom) with 10 subs` | 255ns | 1.9µs | 🟢 7.5× faster |
| `store.get(atom)` | 14ns | 160ns | 🟢 11.9× faster |
| `sub + unsub` | 847ns | 2.1µs | 🟢 2.4× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 176.8µs | 108.4µs | 🔴 1.6× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 91.1µs | 57.6µs | 🔴 1.6× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 781.2µs | 717.0µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 71.5µs | 149.0µs | 🟢 2.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 80.6µs | 242.5µs | 🟢 3.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 792.9µs | 1.39ms | 🟢 1.8× faster |
| `txn: asymmetric DAG shared sink` | 23.5µs | 54.1µs | 🟢 2.3× faster |
| `txn: cross-atom 1000 selectors, set + read` | 990.6µs | 1.88ms | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.04ms | 13.13ms | 🟢 12.6× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.85ms | 9.71ms | 🟢 2.5× faster |

<!-- BENCH:END -->
