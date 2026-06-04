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
| `atom lifecycle (create+100get+100set)` | 9.1µs | 207.2µs | 🟢 22.8× faster |
| `atom(1)` | 2ns | 44ns | 🟢 24.3× faster |
| `atomFamily(id)` | 212ns | 364ns | 🟢 1.7× faster |
| `atomFamily(id) cache hit` | 8ns | 9ns | 🟢 1.2× faster |
| `createStore` | 199ns | 3.9µs | 🟢 19.7× faster |
| `get 1000 atoms` | 8.2µs | 493.3µs | 🟢 60.3× faster |
| `selector(fn)` | 3ns | 45ns | 🟢 13.1× faster |
| `selectorFamily(id)` | 165ns | 347ns | 🟢 2.1× faster |
| `set + read 10 selectors` | 5.3µs | 29.1µs | 🟢 5.5× faster |
| `set + read 100 selectorFamily entries` | 47.2µs | 197.7µs | 🟢 4.2× faster |
| `set + read 100 selectors` | 43.5µs | 200.8µs | 🟢 4.6× faster |
| `set + read through 5 chained selectors` | 4.1µs | 11.5µs | 🟢 2.8× faster |
| `set 1000 atoms` | 76.8µs | 720.6µs | 🟢 9.4× faster |
| `set(atom, curr => curr+1)` | 72ns | 2.3µs | 🟢 31.4× faster |
| `set(atom, value)` | 140ns | 1.7µs | 🟢 12.1× faster |
| `set(atom) with 10 subs` | 104ns | 3.1µs | 🟢 29.5× faster |
| `store.get(atom)` | 30ns | 300ns | 🟢 10.0× faster |
| `sub + unsub` | 241ns | 2.7µs | 🟢 11.3× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 89.6µs | 139.0µs | 🟢 1.6× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 48.2µs | 73.8µs | 🟢 1.5× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 407.9µs | 669.2µs | 🟢 1.6× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 46.5µs | 282.1µs | 🟢 6.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 57.0µs | 445.7µs | 🟢 7.8× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 453.0µs | 2.15ms | 🟢 4.7× faster |
| `txn: asymmetric DAG shared sink` | 16.2µs | 84.1µs | 🟢 5.2× faster |
| `txn: cross-atom 1000 selectors, set + read` | 584.6µs | 2.91ms | 🟢 5.0× faster |
| `txn: cross-atom 1000 selectors, with subs` | 706.5µs | 20.02ms | 🟢 28.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.01ms | 11.04ms | 🟢 3.7× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 18.9µs | 121.7µs | 🟢 6.4× faster |
| `atom(1)` | 21ns | 37ns | 🟢 1.8× faster |
| `atomFamily(id)` | 141ns | 308ns | 🟢 2.2× faster |
| `atomFamily(id) cache hit` | 4ns | 6ns | 🟢 1.6× faster |
| `createStore` | 136ns | 1.3µs | 🟢 9.7× faster |
| `get 1000 atoms` | 11.8µs | 160.7µs | 🟢 13.6× faster |
| `selector(fn)` | 34ns | 42ns | 🟢 1.2× faster |
| `selectorFamily(id)` | 224ns | 209ns | 🔴 1.1× slower |
| `set + read 10 selectors` | 5.7µs | 15.5µs | 🟢 2.7× faster |
| `set + read 100 selectorFamily entries` | 51.1µs | 113.4µs | 🟢 2.2× faster |
| `set + read 100 selectors` | 50.5µs | 101.5µs | 🟢 2.0× faster |
| `set + read through 5 chained selectors` | 3.8µs | 9.1µs | 🟢 2.4× faster |
| `set 1000 atoms` | 62.0µs | 323.6µs | 🟢 5.2× faster |
| `set(atom, curr => curr+1)` | 153ns | 1.2µs | 🟢 8.2× faster |
| `set(atom, value)` | 161ns | 1.0µs | 🟢 6.4× faster |
| `set(atom) with 10 subs` | 180ns | 1.5µs | 🟢 8.1× faster |
| `store.get(atom)` | 26ns | 159ns | 🟢 6.0× faster |
| `sub + unsub` | 558ns | 1.6µs | 🟢 2.9× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 98.8µs | 82.3µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 53.3µs | 43.0µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 449.7µs | 416.8µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 52.4µs | 115.4µs | 🟢 2.2× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 54.0µs | 187.8µs | 🟢 3.5× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 583.7µs | 1.01ms | 🟢 1.7× faster |
| `txn: asymmetric DAG shared sink` | 16.0µs | 42.5µs | 🟢 2.7× faster |
| `txn: cross-atom 1000 selectors, set + read` | 724.0µs | 1.41ms | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 711.5µs | 9.78ms | 🟢 13.7× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.74ms | 7.22ms | 🟢 2.6× faster |

<!-- BENCH:END -->
