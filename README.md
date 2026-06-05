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
| `atom lifecycle (create+100get+100set)` | 11.7µs | 265.6µs | 🟢 22.6× faster |
| `atom(1)` | 2ns | 53ns | 🟢 24.3× faster |
| `atomFamily(id)` | 126ns | 406ns | 🟢 3.2× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 263ns | 5.3µs | 🟢 20.3× faster |
| `get 1000 atoms` | 10.1µs | 405.5µs | 🟢 40.0× faster |
| `selector(fn)` | 4ns | 58ns | 🟢 13.2× faster |
| `selectorFamily(id)` | 148ns | 219ns | 🟢 1.5× faster |
| `set + read 10 selectors` | 8.0µs | 37.2µs | 🟢 4.7× faster |
| `set + read 100 selectorFamily entries` | 65.8µs | 269.7µs | 🟢 4.1× faster |
| `set + read 100 selectors` | 66.3µs | 348.1µs | 🟢 5.3× faster |
| `set + read through 5 chained selectors` | 6.3µs | 16.8µs | 🟢 2.7× faster |
| `set 1000 atoms` | 103.1µs | 976.7µs | 🟢 9.5× faster |
| `set(atom, curr => curr+1)` | 99ns | 3.2µs | 🟢 32.5× faster |
| `set(atom, value)` | 140ns | 2.7µs | 🟢 19.3× faster |
| `set(atom) with 10 subs` | 147ns | 4.0µs | 🟢 27.1× faster |
| `store.get(atom)` | 40ns | 371ns | 🟢 9.3× faster |
| `sub + unsub` | 509ns | 3.3µs | 🟢 6.4× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 120.9µs | 133.9µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 69.5µs | 100.6µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 548.1µs | 637.1µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 74.9µs | 296.6µs | 🟢 4.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 85.0µs | 632.1µs | 🟢 7.4× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 728.7µs | 3.65ms | 🟢 5.0× faster |
| `txn: asymmetric DAG shared sink` | 25.7µs | 163.3µs | 🟢 6.4× faster |
| `txn: cross-atom 1000 selectors, set + read` | 910.4µs | 5.24ms | 🟢 5.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.04ms | 22.75ms | 🟢 21.8× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.19ms | 23.20ms | 🟢 5.5× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 27.1µs | 146.4µs | 🟢 5.4× faster |
| `atom(1)` | 25ns | 50ns | 🟢 2.0× faster |
| `atomFamily(id)` | 156ns | 252ns | 🟢 1.6× faster |
| `atomFamily(id) cache hit` | 5ns | 27ns | 🟢 5.9× faster |
| `createStore` | 183ns | 1.6µs | 🟢 8.7× faster |
| `get 1000 atoms` | 15.0µs | 208.6µs | 🟢 13.9× faster |
| `selector(fn)` | 43ns | 61ns | 🟢 1.4× faster |
| `selectorFamily(id)` | 169ns | 235ns | 🟢 1.4× faster |
| `set + read 10 selectors` | 8.3µs | 19.4µs | 🟢 2.3× faster |
| `set + read 100 selectorFamily entries` | 74.2µs | 131.8µs | 🟢 1.8× faster |
| `set + read 100 selectors` | 74.4µs | 133.9µs | 🟢 1.8× faster |
| `set + read through 5 chained selectors` | 5.0µs | 10.0µs | 🟢 2.0× faster |
| `set 1000 atoms` | 83.4µs | 454.4µs | 🟢 5.4× faster |
| `set(atom, curr => curr+1)` | 225ns | 1.5µs | 🟢 6.8× faster |
| `set(atom, value)` | 224ns | 1.3µs | 🟢 5.8× faster |
| `set(atom) with 10 subs` | 260ns | 1.8µs | 🟢 6.8× faster |
| `store.get(atom)` | 18ns | 160ns | 🟢 8.9× faster |
| `sub + unsub` | 862ns | 2.1µs | 🟢 2.4× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 131.5µs | 108.4µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 70.3µs | 57.6µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 608.3µs | 538.5µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 138.9µs | 177.3µs | 🟢 1.3× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 87.1µs | 263.5µs | 🟢 3.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 877.8µs | 1.38ms | 🟢 1.6× faster |
| `txn: asymmetric DAG shared sink` | 25.0µs | 55.5µs | 🟢 2.2× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.04ms | 1.92ms | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 997.3µs | 12.04ms | 🟢 12.1× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.73ms | 9.19ms | 🟢 2.5× faster |

<!-- BENCH:END -->
