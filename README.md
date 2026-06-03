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

[![store.get(atom) latency — valdres vs Jotai vs raw Map (Bun + Node)](https://api.bencher.dev/v0/projects/valdres/perf/img?branches=ca02205d-e4c5-4f8e-a227-9790cc6d7f7d&testbeds=6ed7a83d-343c-43c1-b270-225a1688718e%2C0c5502c7-6901-4334-a06c-110e7468d6bb&benchmarks=cc14bb7a-a64d-4e0c-a277-abde4e2f8449%2C7406c2e2-a4cc-4327-935a-2f7fbc9c41b7%2C741adc2f-32e7-47d6-9759-42cf16fc5c8a&measures=34bb7b72-22ec-45bd-bb99-0768d0e0319e&title=store.get%28atom%29+latency%3A+valdres+vs+jotai+vs+map)](https://bencher.dev/perf/valdres?branches=ca02205d-e4c5-4f8e-a227-9790cc6d7f7d&testbeds=6ed7a83d-343c-43c1-b270-225a1688718e%2C0c5502c7-6901-4334-a06c-110e7468d6bb&benchmarks=cc14bb7a-a64d-4e0c-a277-abde4e2f8449%2C7406c2e2-a4cc-4327-935a-2f7fbc9c41b7%2C741adc2f-32e7-47d6-9759-42cf16fc5c8a&measures=34bb7b72-22ec-45bd-bb99-0768d0e0319e&tab=plots&x_axis=date_time)

<sub>Live plot — `store.get(atom)` latency, valdres vs Jotai vs a raw `Map` floor, on both runtimes. Auto-updates from `main`; click through to filter/zoom. (Sparse until `main` accumulates a few runs.)</sub>

Every PR from the repo gets a comment flagging any latency regression vs `main` (fork PRs are skipped — they can't read the upload key).

<!-- BENCH:START -->
### Performance vs Jotai

Latest `main` latency per operation (live, always-current numbers: [bencher.dev/perf/valdres](https://bencher.dev/perf/valdres)). Auto-generated from Bencher — do not hand-edit.

#### Bun (JavaScriptCore)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 9.0µs | 210.1µs | 🟢 23.2× faster |
| `atom(1)` | 2ns | 46ns | 🟢 24.6× faster |
| `atomFamily(id)` | 255ns | 389ns | 🟢 1.5× faster |
| `atomFamily(id) cache hit` | 25ns | 9ns | 🔴 2.7× slower |
| `createStore` | 220ns | 4.9µs | 🟢 22.4× faster |
| `get 1000 atoms` | 7.8µs | 316.9µs | 🟢 40.8× faster |
| `selector(fn)` | 4ns | 47ns | 🟢 11.8× faster |
| `selectorFamily(id)` | 234ns | 370ns | 🟢 1.6× faster |
| `set + read 10 selectors` | 4.7µs | 29.6µs | 🟢 6.2× faster |
| `set + read 100 selectorFamily entries` | 72.0µs | 204.6µs | 🟢 2.8× faster |
| `set + read 100 selectors` | 39.5µs | 267.3µs | 🟢 6.8× faster |
| `set + read through 5 chained selectors` | 4.7µs | 15.5µs | 🟢 3.3× faster |
| `set 1000 atoms` | 75.0µs | 717.6µs | 🟢 9.6× faster |
| `set(atom, curr => curr+1)` | 73ns | 2.5µs | 🟢 33.9× faster |
| `set(atom, value)` | 78ns | 2.0µs | 🟢 25.6× faster |
| `set(atom) with 10 subs` | 106ns | 3.5µs | 🟢 33.1× faster |
| `store.get(atom)` | 30ns | 300ns | 🟢 10.0× faster |
| `sub + unsub` | 331ns | 2.8µs | 🟢 8.4× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 80.0µs | 142.1µs | 🟢 1.8× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 47.3µs | 77.7µs | 🟢 1.6× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 377.9µs | 514.4µs | 🟢 1.4× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 47.0µs | 224.5µs | 🟢 4.8× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 78.6µs | 463.6µs | 🟢 5.9× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 481.5µs | 2.92ms | 🟢 6.1× faster |
| `txn: asymmetric DAG shared sink` | 22.0µs | 119.5µs | 🟢 5.4× faster |
| `txn: cross-atom 1000 selectors, set + read` | 572.4µs | 4.37ms | 🟢 7.6× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.10ms | 18.83ms | 🟢 17.1× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.40ms | 13.30ms | 🟢 3.9× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 19.8µs | 123.9µs | 🟢 6.3× faster |
| `atom(1)` | 23ns | 38ns | 🟢 1.7× faster |
| `atomFamily(id)` | 309ns | 407ns | 🟢 1.3× faster |
| `atomFamily(id) cache hit` | 18ns | 21ns | 🟢 1.1× faster |
| `createStore` | 140ns | 1.5µs | 🟢 10.8× faster |
| `get 1000 atoms` | 11.8µs | 162.2µs | 🟢 13.8× faster |
| `selector(fn)` | 34ns | 42ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 296ns | 270ns | 🔴 1.1× slower |
| `set + read 10 selectors` | 6.0µs | 16.8µs | 🟢 2.8× faster |
| `set + read 100 selectorFamily entries` | 52.6µs | 113.3µs | 🟢 2.2× faster |
| `set + read 100 selectors` | 52.7µs | 102.9µs | 🟢 2.0× faster |
| `set + read through 5 chained selectors` | 4.3µs | 8.8µs | 🟢 2.0× faster |
| `set 1000 atoms` | 63.8µs | 331.4µs | 🟢 5.2× faster |
| `set(atom, curr => curr+1)` | 159ns | 1.3µs | 🟢 8.3× faster |
| `set(atom, value)` | 163ns | 1.1µs | 🟢 6.5× faster |
| `set(atom) with 10 subs` | 188ns | 1.5µs | 🟢 7.9× faster |
| `store.get(atom)` | 11ns | 159ns | 🟢 13.9× faster |
| `sub + unsub` | 632ns | 1.8µs | 🟢 2.9× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 132.0µs | 82.6µs | 🔴 1.6× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 69.6µs | 44.1µs | 🔴 1.6× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 600.5µs | 405.8µs | 🔴 1.5× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 50.1µs | 114.7µs | 🟢 2.3× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 57.7µs | 188.6µs | 🟢 3.3× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 568.4µs | 1.04ms | 🟢 1.8× faster |
| `txn: asymmetric DAG shared sink` | 16.8µs | 42.5µs | 🟢 2.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 710.3µs | 1.43ms | 🟢 2.0× faster |
| `txn: cross-atom 1000 selectors, with subs` | 756.2µs | 10.65ms | 🟢 14.1× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.87ms | 7.99ms | 🟢 2.8× faster |

<!-- BENCH:END -->
