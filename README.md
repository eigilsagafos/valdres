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
| `atom lifecycle (create+100get+100set)` | 12.2µs | 260.5µs | 🟢 21.4× faster |
| `atom(1)` | 3ns | 57ns | 🟢 21.0× faster |
| `atomFamily(id)` | 186ns | 384ns | 🟢 2.1× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 340ns | 6.0µs | 🟢 17.6× faster |
| `get 1000 atoms` | 10.1µs | 416.6µs | 🟢 41.3× faster |
| `selector(fn)` | 4ns | 59ns | 🟢 13.8× faster |
| `selectorFamily(id)` | 237ns | 212ns | 🔴 1.1× slower |
| `set + read 10 selectors` | 8.6µs | 37.5µs | 🟢 4.4× faster |
| `set + read 100 selectorFamily entries` | 71.8µs | 282.3µs | 🟢 3.9× faster |
| `set + read 100 selectors` | 69.4µs | 359.1µs | 🟢 5.2× faster |
| `set + read through 5 chained selectors` | 6.8µs | 19.5µs | 🟢 2.9× faster |
| `set 1000 atoms` | 102.6µs | 1.04ms | 🟢 10.1× faster |
| `set(atom, curr => curr+1)` | 103ns | 3.4µs | 🟢 33.4× faster |
| `set(atom, value)` | 130ns | 5.0µs | 🟢 38.7× faster |
| `set(atom) with 10 subs` | 150ns | 4.3µs | 🟢 28.7× faster |
| `store.get(atom)` | 40ns | 381ns | 🟢 9.5× faster |
| `sub + unsub` | 669ns | 3.5µs | 🟢 5.2× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 121.4µs | 140.5µs | 🟢 1.2× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 70.7µs | 98.7µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 576.7µs | 654.5µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 77.3µs | 304.5µs | 🟢 3.9× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 90.1µs | 642.5µs | 🟢 7.1× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 731.1µs | 3.74ms | 🟢 5.1× faster |
| `txn: asymmetric DAG shared sink` | 28.4µs | 154.0µs | 🟢 5.4× faster |
| `txn: cross-atom 1000 selectors, set + read` | 905.8µs | 5.60ms | 🟢 6.2× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.07ms | 24.27ms | 🟢 22.6× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.87ms | 21.61ms | 🟢 4.4× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 24.7µs | 143.3µs | 🟢 5.8× faster |
| `atom(1)` | 25ns | 56ns | 🟢 2.2× faster |
| `atomFamily(id)` | 107ns | 259ns | 🟢 2.4× faster |
| `atomFamily(id) cache hit` | 4ns | 26ns | 🟢 6.0× faster |
| `createStore` | 185ns | 1.5µs | 🟢 8.3× faster |
| `get 1000 atoms` | 15.0µs | 209.9µs | 🟢 14.0× faster |
| `selector(fn)` | 43ns | 62ns | 🟢 1.4× faster |
| `selectorFamily(id)` | 156ns | 187ns | 🟢 1.2× faster |
| `set + read 10 selectors` | 8.0µs | 19.7µs | 🟢 2.5× faster |
| `set + read 100 selectorFamily entries` | 75.1µs | 130.0µs | 🟢 1.7× faster |
| `set + read 100 selectors` | 72.7µs | 129.4µs | 🟢 1.8× faster |
| `set + read through 5 chained selectors` | 5.0µs | 9.5µs | 🟢 1.9× faster |
| `set 1000 atoms` | 89.2µs | 463.3µs | 🟢 5.2× faster |
| `set(atom, curr => curr+1)` | 219ns | 1.5µs | 🟢 6.6× faster |
| `set(atom, value)` | 223ns | 1.2µs | 🟢 5.6× faster |
| `set(atom) with 10 subs` | 275ns | 1.7µs | 🟢 6.4× faster |
| `store.get(atom)` | 18ns | 162ns | 🟢 9.0× faster |
| `sub + unsub` | 878ns | 2.1µs | 🟢 2.4× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 132.9µs | 106.3µs | 🔴 1.3× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 71.6µs | 55.9µs | 🔴 1.3× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 616.6µs | 520.1µs | 🔴 1.2× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 117.1µs | 178.7µs | 🟢 1.5× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 86.2µs | 252.1µs | 🟢 2.9× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 832.1µs | 1.36ms | 🟢 1.6× faster |
| `txn: asymmetric DAG shared sink` | 23.6µs | 55.1µs | 🟢 2.3× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.04ms | 1.94ms | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 969.5µs | 12.47ms | 🟢 12.9× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.76ms | 9.77ms | 🟢 2.6× faster |

<!-- BENCH:END -->
