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
| `atom lifecycle (create+100get+100set)` | 11.9µs | 271.7µs | 🟢 22.9× faster |
| `atom(1)` | 2ns | 59ns | 🟢 24.2× faster |
| `atomFamily(id)` | 270ns | 483ns | 🟢 1.8× faster |
| `atomFamily(id) cache hit` | 10ns | 12ns | 🟢 1.2× faster |
| `createStore` | 282ns | 5.1µs | 🟢 18.2× faster |
| `get 1000 atoms` | 10.2µs | 637.1µs | 🟢 62.2× faster |
| `selector(fn)` | 6ns | 62ns | 🟢 10.0× faster |
| `selectorFamily(id)` | 249ns | 527ns | 🟢 2.1× faster |
| `set + read 10 selectors` | 7.6µs | 37.6µs | 🟢 5.0× faster |
| `set + read 100 selectorFamily entries` | 68.1µs | 282.6µs | 🟢 4.2× faster |
| `set + read 100 selectors` | 69.3µs | 347.4µs | 🟢 5.0× faster |
| `set + read through 5 chained selectors` | 5.6µs | 17.2µs | 🟢 3.0× faster |
| `set 1000 atoms` | 98.5µs | 924.2µs | 🟢 9.4× faster |
| `set(atom, curr => curr+1)` | 95ns | 3.1µs | 🟢 32.4× faster |
| `set(atom, value)` | 141ns | 2.3µs | 🟢 16.7× faster |
| `set(atom) with 10 subs` | 143ns | 4.0µs | 🟢 28.2× faster |
| `store.get(atom)` | 40ns | 390ns | 🟢 9.8× faster |
| `sub + unsub` | 354ns | 3.8µs | 🟢 10.7× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 130.6µs | 158.4µs | 🟢 1.2× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 101.9µs | 109.1µs | 🟢 1.1× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 685.5µs | 693.0µs | 🟢 1.0× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 63.6µs | 286.1µs | 🟢 4.5× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 70.6µs | 560.0µs | 🟢 7.9× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 612.6µs | 2.85ms | 🟢 4.7× faster |
| `txn: asymmetric DAG shared sink` | 23.0µs | 116.0µs | 🟢 5.0× faster |
| `txn: cross-atom 1000 selectors, set + read` | 754.5µs | 3.72ms | 🟢 4.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 930.5µs | 22.18ms | 🟢 23.8× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.95ms | 16.68ms | 🟢 4.2× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 23.0µs | 141.2µs | 🟢 6.1× faster |
| `atom(1)` | 28ns | 48ns | 🟢 1.7× faster |
| `atomFamily(id)` | 173ns | 444ns | 🟢 2.6× faster |
| `atomFamily(id) cache hit` | 4ns | 28ns | 🟢 7.8× faster |
| `createStore` | 178ns | 1.9µs | 🟢 10.8× faster |
| `get 1000 atoms` | 15.2µs | 206.5µs | 🟢 13.6× faster |
| `selector(fn)` | 47ns | 56ns | 🟢 1.2× faster |
| `selectorFamily(id)` | 229ns | 279ns | 🟢 1.2× faster |
| `set + read 10 selectors` | 7.7µs | 23.5µs | 🟢 3.1× faster |
| `set + read 100 selectorFamily entries` | 66.7µs | 129.4µs | 🟢 1.9× faster |
| `set + read 100 selectors` | 65.1µs | 129.0µs | 🟢 2.0× faster |
| `set + read through 5 chained selectors` | 4.9µs | 10.5µs | 🟢 2.2× faster |
| `set 1000 atoms` | 79.8µs | 438.6µs | 🟢 5.5× faster |
| `set(atom, curr => curr+1)` | 196ns | 1.5µs | 🟢 7.6× faster |
| `set(atom, value)` | 206ns | 1.3µs | 🟢 6.1× faster |
| `set(atom) with 10 subs` | 228ns | 1.8µs | 🟢 7.8× faster |
| `store.get(atom)` | 15ns | 163ns | 🟢 11.1× faster |
| `sub + unsub` | 744ns | 2.4µs | 🟢 3.2× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 127.8µs | 108.9µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 68.1µs | 57.4µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 578.4µs | 526.0µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 65.3µs | 148.9µs | 🟢 2.3× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 70.0µs | 247.4µs | 🟢 3.5× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 745.7µs | 1.37ms | 🟢 1.8× faster |
| `txn: asymmetric DAG shared sink` | 20.5µs | 54.8µs | 🟢 2.7× faster |
| `txn: cross-atom 1000 selectors, set + read` | 916.1µs | 1.84ms | 🟢 2.0× faster |
| `txn: cross-atom 1000 selectors, with subs` | 905.4µs | 13.39ms | 🟢 14.8× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.52ms | 9.93ms | 🟢 2.8× faster |

<!-- BENCH:END -->
