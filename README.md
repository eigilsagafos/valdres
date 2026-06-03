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
| `atom lifecycle (create+100get+100set)` | 12.1µs | 257.6µs | 🟢 21.2× faster |
| `atom(1)` | 3ns | 54ns | 🟢 21.3× faster |
| `atomFamily(id)` | 260ns | 430ns | 🟢 1.7× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 257ns | 5.3µs | 🟢 20.6× faster |
| `get 1000 atoms` | 9.9µs | 641.8µs | 🟢 64.6× faster |
| `selector(fn)` | 5ns | 61ns | 🟢 12.5× faster |
| `selectorFamily(id)` | 204ns | 423ns | 🟢 2.1× faster |
| `set + read 10 selectors` | 8.0µs | 36.9µs | 🟢 4.6× faster |
| `set + read 100 selectorFamily entries` | 72.0µs | 274.4µs | 🟢 3.8× faster |
| `set + read 100 selectors` | 68.7µs | 348.2µs | 🟢 5.1× faster |
| `set + read through 5 chained selectors` | 5.9µs | 18.2µs | 🟢 3.1× faster |
| `set 1000 atoms` | 101.2µs | 964.6µs | 🟢 9.5× faster |
| `set(atom, curr => curr+1)` | 99ns | 3.0µs | 🟢 30.0× faster |
| `set(atom, value)` | 141ns | 2.1µs | 🟢 15.0× faster |
| `set(atom) with 10 subs` | 142ns | 4.0µs | 🟢 28.5× faster |
| `store.get(atom)` | 31ns | 371ns | 🟢 12.0× faster |
| `sub + unsub` | 445ns | 3.4µs | 🟢 7.6× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 122.2µs | 136.8µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 68.2µs | 98.1µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 591.6µs | 657.7µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 72.0µs | 295.8µs | 🟢 4.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 81.4µs | 592.2µs | 🟢 7.3× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 646.3µs | 2.80ms | 🟢 4.3× faster |
| `txn: asymmetric DAG shared sink` | 23.8µs | 119.7µs | 🟢 5.0× faster |
| `txn: cross-atom 1000 selectors, set + read` | 807.2µs | 3.69ms | 🟢 4.6× faster |
| `txn: cross-atom 1000 selectors, with subs` | 943.8µs | 20.29ms | 🟢 21.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.06ms | 15.66ms | 🟢 3.9× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 27.3µs | 139.9µs | 🟢 5.1× faster |
| `atom(1)` | 25ns | 48ns | 🟢 1.9× faster |
| `atomFamily(id)` | 165ns | 376ns | 🟢 2.3× faster |
| `atomFamily(id) cache hit` | 5ns | 35ns | 🟢 7.8× faster |
| `createStore` | 180ns | 1.8µs | 🟢 9.9× faster |
| `get 1000 atoms` | 14.7µs | 207.1µs | 🟢 14.1× faster |
| `selector(fn)` | 44ns | 53ns | 🟢 1.2× faster |
| `selectorFamily(id)` | 186ns | 258ns | 🟢 1.4× faster |
| `set + read 10 selectors` | 7.9µs | 19.6µs | 🟢 2.5× faster |
| `set + read 100 selectorFamily entries` | 75.8µs | 129.7µs | 🟢 1.7× faster |
| `set + read 100 selectors` | 74.0µs | 128.8µs | 🟢 1.7× faster |
| `set + read through 5 chained selectors` | 5.2µs | 9.3µs | 🟢 1.8× faster |
| `set 1000 atoms` | 80.1µs | 446.3µs | 🟢 5.6× faster |
| `set(atom, curr => curr+1)` | 213ns | 1.4µs | 🟢 6.8× faster |
| `set(atom, value)` | 200ns | 1.2µs | 🟢 6.2× faster |
| `set(atom) with 10 subs` | 250ns | 1.7µs | 🟢 6.8× faster |
| `store.get(atom)` | 14ns | 161ns | 🟢 11.9× faster |
| `sub + unsub` | 836ns | 2.1µs | 🟢 2.5× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 130.9µs | 107.1µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 71.0µs | 56.3µs | 🔴 1.3× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 603.2µs | 524.8µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 75.7µs | 148.7µs | 🟢 2.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 73.5µs | 247.0µs | 🟢 3.4× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 797.4µs | 1.33ms | 🟢 1.7× faster |
| `txn: asymmetric DAG shared sink` | 21.9µs | 54.9µs | 🟢 2.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 979.6µs | 1.80ms | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 959.5µs | 12.42ms | 🟢 12.9× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.62ms | 9.76ms | 🟢 2.7× faster |

<!-- BENCH:END -->
