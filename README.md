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
| `atom lifecycle (create+100get+100set)` | 12.1µs | 256.0µs | 🟢 21.2× faster |
| `atom(1)` | 2ns | 54ns | 🟢 24.4× faster |
| `atomFamily(id)` | 173ns | 381ns | 🟢 2.2× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 298ns | 5.9µs | 🟢 19.7× faster |
| `get 1000 atoms` | 9.8µs | 394.4µs | 🟢 40.1× faster |
| `selector(fn)` | 4ns | 57ns | 🟢 14.8× faster |
| `selectorFamily(id)` | 131ns | 185ns | 🟢 1.4× faster |
| `set + read 10 selectors` | 7.7µs | 36.6µs | 🟢 4.7× faster |
| `set + read 100 selectorFamily entries` | 67.7µs | 268.5µs | 🟢 4.0× faster |
| `set + read 100 selectors` | 64.9µs | 346.1µs | 🟢 5.3× faster |
| `set + read through 5 chained selectors` | 6.9µs | 18.5µs | 🟢 2.7× faster |
| `set 1000 atoms` | 107.4µs | 969.2µs | 🟢 9.0× faster |
| `set(atom, curr => curr+1)` | 106ns | 3.5µs | 🟢 33.1× faster |
| `set(atom, value)` | 140ns | 4.1µs | 🟢 29.6× faster |
| `set(atom) with 10 subs` | 145ns | 4.1µs | 🟢 28.5× faster |
| `store.get(atom)` | 40ns | 371ns | 🟢 9.3× faster |
| `sub + unsub` | 550ns | 3.3µs | 🟢 6.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 124.4µs | 136.6µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 72.5µs | 95.5µs | 🟢 1.3× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 606.9µs | 634.4µs | 🟢 1.0× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 75.3µs | 287.4µs | 🟢 3.8× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 88.3µs | 638.8µs | 🟢 7.2× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 691.9µs | 3.64ms | 🟢 5.3× faster |
| `txn: asymmetric DAG shared sink` | 24.3µs | 150.1µs | 🟢 6.2× faster |
| `txn: cross-atom 1000 selectors, set + read` | 859.4µs | 5.26ms | 🟢 6.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.02ms | 22.41ms | 🟢 21.9× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.43ms | 20.45ms | 🟢 4.6× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 29.1µs | 143.4µs | 🟢 4.9× faster |
| `atom(1)` | 25ns | 51ns | 🟢 2.0× faster |
| `atomFamily(id)` | 105ns | 238ns | 🟢 2.3× faster |
| `atomFamily(id) cache hit` | 4ns | 27ns | 🟢 6.1× faster |
| `createStore` | 234ns | 1.7µs | 🟢 7.2× faster |
| `get 1000 atoms` | 15.0µs | 209.9µs | 🟢 14.0× faster |
| `selector(fn)` | 43ns | 57ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 147ns | 187ns | 🟢 1.3× faster |
| `set + read 10 selectors` | 7.2µs | 18.8µs | 🟢 2.6× faster |
| `set + read 100 selectorFamily entries` | 73.8µs | 128.9µs | 🟢 1.7× faster |
| `set + read 100 selectors` | 72.1µs | 128.6µs | 🟢 1.8× faster |
| `set + read through 5 chained selectors` | 4.6µs | 9.6µs | 🟢 2.1× faster |
| `set 1000 atoms` | 95.2µs | 463.5µs | 🟢 4.9× faster |
| `set(atom, curr => curr+1)` | 268ns | 1.5µs | 🟢 5.6× faster |
| `set(atom, value)` | 271ns | 1.3µs | 🟢 4.6× faster |
| `set(atom) with 10 subs` | 307ns | 1.7µs | 🟢 5.6× faster |
| `store.get(atom)` | 18ns | 165ns | 🟢 9.1× faster |
| `sub + unsub` | 802ns | 2.0µs | 🟢 2.5× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 127.3µs | 108.5µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 68.7µs | 56.6µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 584.7µs | 535.8µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 123.3µs | 178.5µs | 🟢 1.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 84.3µs | 255.2µs | 🟢 3.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 826.8µs | 1.36ms | 🟢 1.6× faster |
| `txn: asymmetric DAG shared sink` | 25.0µs | 54.5µs | 🟢 2.2× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.01ms | 1.85ms | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 995.2µs | 11.96ms | 🟢 12.0× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.86ms | 9.04ms | 🟢 2.3× faster |

<!-- BENCH:END -->
