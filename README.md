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
| `atom lifecycle (create+100get+100set)` | 11.6µs | 263.9µs | 🟢 22.8× faster |
| `atom(1)` | 4ns | 70ns | 🟢 16.0× faster |
| `atomFamily(id)` | 173ns | 334ns | 🟢 1.9× faster |
| `atomFamily(id) cache hit` | 10ns | 12ns | 🟢 1.2× faster |
| `createStore` | 309ns | 6.3µs | 🟢 20.5× faster |
| `get 1000 atoms` | 10.3µs | 406.0µs | 🟢 39.4× faster |
| `selector(fn)` | 6ns | 75ns | 🟢 12.4× faster |
| `selectorFamily(id)` | 202ns | 338ns | 🟢 1.7× faster |
| `set + read 10 selectors` | 8.4µs | 36.6µs | 🟢 4.4× faster |
| `set + read 100 selectorFamily entries` | 67.7µs | 250.6µs | 🟢 3.7× faster |
| `set + read 100 selectors` | 67.9µs | 327.3µs | 🟢 4.8× faster |
| `set + read through 5 chained selectors` | 6.2µs | 16.0µs | 🟢 2.6× faster |
| `set 1000 atoms` | 97.5µs | 975.9µs | 🟢 10.0× faster |
| `set(atom, curr => curr+1)` | 136ns | 3.7µs | 🟢 27.4× faster |
| `set(atom, value)` | 118ns | 5.8µs | 🟢 49.2× faster |
| `set(atom) with 10 subs` | 146ns | 4.2µs | 🟢 29.0× faster |
| `store.get(atom)` | 30ns | 354ns | 🟢 11.8× faster |
| `sub + unsub` | 456ns | 3.3µs | 🟢 7.2× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 124.5µs | 144.1µs | 🟢 1.2× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 69.5µs | 103.0µs | 🟢 1.5× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 586.9µs | 671.7µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 74.0µs | 273.4µs | 🟢 3.7× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 84.6µs | 583.5µs | 🟢 6.9× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 686.5µs | 3.32ms | 🟢 4.8× faster |
| `txn: asymmetric DAG shared sink` | 24.9µs | 139.8µs | 🟢 5.6× faster |
| `txn: cross-atom 1000 selectors, set + read` | 830.1µs | 4.97ms | 🟢 6.0× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.06ms | 22.58ms | 🟢 21.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.40ms | 20.61ms | 🟢 4.7× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 29.3µs | 136.1µs | 🟢 4.6× faster |
| `atom(1)` | 25ns | 58ns | 🟢 2.3× faster |
| `atomFamily(id)` | 148ns | 256ns | 🟢 1.7× faster |
| `atomFamily(id) cache hit` | 5ns | 23ns | 🟢 5.2× faster |
| `createStore` | 349ns | 2.0µs | 🟢 5.6× faster |
| `get 1000 atoms` | 13.4µs | 189.1µs | 🟢 14.1× faster |
| `selector(fn)` | 49ns | 66ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 195ns | 257ns | 🟢 1.3× faster |
| `set + read 10 selectors` | 7.7µs | 20.3µs | 🟢 2.6× faster |
| `set + read 100 selectorFamily entries` | 70.5µs | 133.0µs | 🟢 1.9× faster |
| `set + read 100 selectors` | 68.9µs | 132.4µs | 🟢 1.9× faster |
| `set + read through 5 chained selectors` | 4.6µs | 10.2µs | 🟢 2.2× faster |
| `set 1000 atoms` | 87.9µs | 439.9µs | 🟢 5.0× faster |
| `set(atom, curr => curr+1)` | 258ns | 1.5µs | 🟢 5.9× faster |
| `set(atom, value)` | 253ns | 1.3µs | 🟢 5.2× faster |
| `set(atom) with 10 subs` | 295ns | 1.9µs | 🟢 6.3× faster |
| `store.get(atom)` | 16ns | 162ns | 🟢 10.3× faster |
| `sub + unsub` | 756ns | 2.3µs | 🟢 3.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 132.7µs | 119.3µs | 🔴 1.1× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 72.7µs | 64.2µs | 🔴 1.1× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 630.7µs | 600.4µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 79.8µs | 192.8µs | 🟢 2.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 74.1µs | 273.0µs | 🟢 3.7× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 772.4µs | 1.47ms | 🟢 1.9× faster |
| `txn: asymmetric DAG shared sink` | 22.7µs | 59.1µs | 🟢 2.6× faster |
| `txn: cross-atom 1000 selectors, set + read` | 959.7µs | 2.04ms | 🟢 2.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 923.2µs | 12.17ms | 🟢 13.2× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.80ms | 9.67ms | 🟢 2.5× faster |

<!-- BENCH:END -->
