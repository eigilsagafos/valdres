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
| `atom lifecycle (create+100get+100set)` | 11.5µs | 262.9µs | 🟢 22.9× faster |
| `atom(1)` | 2ns | 56ns | 🟢 24.8× faster |
| `atomFamily(id)` | 177ns | 384ns | 🟢 2.2× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 273ns | 5.5µs | 🟢 20.0× faster |
| `get 1000 atoms` | 10.0µs | 664.8µs | 🟢 66.4× faster |
| `selector(fn)` | 4ns | 59ns | 🟢 13.7× faster |
| `selectorFamily(id)` | 141ns | 170ns | 🟢 1.2× faster |
| `set + read 10 selectors` | 8.0µs | 38.1µs | 🟢 4.8× faster |
| `set + read 100 selectorFamily entries` | 69.5µs | 270.1µs | 🟢 3.9× faster |
| `set + read 100 selectors` | 67.9µs | 362.2µs | 🟢 5.3× faster |
| `set + read through 5 chained selectors` | 5.6µs | 18.1µs | 🟢 3.3× faster |
| `set 1000 atoms` | 105.4µs | 964.2µs | 🟢 9.2× faster |
| `set(atom, curr => curr+1)` | 102ns | 3.1µs | 🟢 30.0× faster |
| `set(atom, value)` | 128ns | 5.3µs | 🟢 41.1× faster |
| `set(atom) with 10 subs` | 139ns | 4.0µs | 🟢 28.9× faster |
| `store.get(atom)` | 40ns | 371ns | 🟢 9.3× faster |
| `sub + unsub` | 686ns | 4.8µs | 🟢 7.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 125.0µs | 135.0µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 71.0µs | 95.5µs | 🟢 1.3× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 599.6µs | 646.7µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 74.1µs | 327.3µs | 🟢 4.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 95.0µs | 702.0µs | 🟢 7.4× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.24ms | 4.74ms | 🟢 3.8× faster |
| `txn: asymmetric DAG shared sink` | 44.3µs | 167.5µs | 🟢 3.8× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.42ms | 5.55ms | 🟢 3.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 990.6µs | 24.92ms | 🟢 25.2× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.68ms | 21.69ms | 🟢 4.6× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 27.4µs | 145.9µs | 🟢 5.3× faster |
| `atom(1)` | 25ns | 49ns | 🟢 2.0× faster |
| `atomFamily(id)` | 182ns | 250ns | 🟢 1.4× faster |
| `atomFamily(id) cache hit` | 4ns | 26ns | 🟢 5.9× faster |
| `createStore` | 193ns | 2.1µs | 🟢 10.7× faster |
| `get 1000 atoms` | 15.1µs | 211.3µs | 🟢 14.0× faster |
| `selector(fn)` | 45ns | 58ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 151ns | 211ns | 🟢 1.4× faster |
| `set + read 10 selectors` | 8.2µs | 19.4µs | 🟢 2.4× faster |
| `set + read 100 selectorFamily entries` | 75.2µs | 132.2µs | 🟢 1.8× faster |
| `set + read 100 selectors` | 73.1µs | 130.9µs | 🟢 1.8× faster |
| `set + read through 5 chained selectors` | 4.9µs | 10.1µs | 🟢 2.0× faster |
| `set 1000 atoms` | 82.9µs | 451.3µs | 🟢 5.4× faster |
| `set(atom, curr => curr+1)` | 231ns | 1.5µs | 🟢 6.5× faster |
| `set(atom, value)` | 222ns | 1.3µs | 🟢 5.7× faster |
| `set(atom) with 10 subs` | 269ns | 1.8µs | 🟢 6.5× faster |
| `store.get(atom)` | 18ns | 161ns | 🟢 8.9× faster |
| `sub + unsub` | 883ns | 2.2µs | 🟢 2.4× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 131.1µs | 108.4µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 70.1µs | 57.4µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 617.6µs | 532.3µs | 🔴 1.2× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 119.6µs | 172.9µs | 🟢 1.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 82.8µs | 260.1µs | 🟢 3.1× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 825.0µs | 1.35ms | 🟢 1.6× faster |
| `txn: asymmetric DAG shared sink` | 24.5µs | 55.3µs | 🟢 2.3× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.02ms | 1.94ms | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 989.6µs | 12.16ms | 🟢 12.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.83ms | 9.18ms | 🟢 2.4× faster |

<!-- BENCH:END -->
