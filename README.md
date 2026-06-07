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
| `atom lifecycle (create+100get+100set)` | 12.1µs | 314.5µs | 🟢 26.0× faster |
| `atom(1)` | 2ns | 65ns | 🟢 27.5× faster |
| `atomFamily(id)` | 218ns | 424ns | 🟢 1.9× faster |
| `atomFamily(id) cache hit` | 10ns | 12ns | 🟢 1.2× faster |
| `createStore` | 300ns | 5.2µs | 🟢 17.3× faster |
| `get 1000 atoms` | 10.6µs | 417.3µs | 🟢 39.3× faster |
| `selector(fn)` | 5ns | 65ns | 🟢 12.1× faster |
| `selectorFamily(id)` | 156ns | 218ns | 🟢 1.4× faster |
| `set + read 10 selectors` | 8.2µs | 38.3µs | 🟢 4.7× faster |
| `set + read 100 selectorFamily entries` | 61.7µs | 266.9µs | 🟢 4.3× faster |
| `set + read 100 selectors` | 69.2µs | 354.4µs | 🟢 5.1× faster |
| `set + read through 5 chained selectors` | 6.0µs | 17.9µs | 🟢 3.0× faster |
| `set 1000 atoms` | 103.8µs | 983.8µs | 🟢 9.5× faster |
| `set(atom, curr => curr+1)` | 114ns | 3.1µs | 🟢 27.5× faster |
| `set(atom, value)` | 148ns | 4.8µs | 🟢 32.6× faster |
| `set(atom) with 10 subs` | 152ns | 3.4µs | 🟢 22.2× faster |
| `store.get(atom)` | 40ns | 381ns | 🟢 9.5× faster |
| `sub + unsub` | 481ns | 3.2µs | 🟢 6.6× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 122.7µs | 139.8µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 73.9µs | 99.7µs | 🟢 1.3× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 718.6µs | 666.9µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 66.5µs | 283.5µs | 🟢 4.3× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 80.5µs | 612.7µs | 🟢 7.6× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 708.9µs | 3.63ms | 🟢 5.1× faster |
| `txn: asymmetric DAG shared sink` | 23.6µs | 151.4µs | 🟢 6.4× faster |
| `txn: cross-atom 1000 selectors, set + read` | 856.9µs | 5.29ms | 🟢 6.2× faster |
| `txn: cross-atom 1000 selectors, with subs` | 937.3µs | 24.74ms | 🟢 26.4× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.14ms | 22.01ms | 🟢 5.3× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 27.3µs | 137.8µs | 🟢 5.0× faster |
| `atom(1)` | 27ns | 49ns | 🟢 1.8× faster |
| `atomFamily(id)` | 119ns | 226ns | 🟢 1.9× faster |
| `atomFamily(id) cache hit` | 5ns | 27ns | 🟢 5.5× faster |
| `createStore` | 228ns | 2.0µs | 🟢 8.6× faster |
| `get 1000 atoms` | 15.1µs | 210.8µs | 🟢 14.0× faster |
| `selector(fn)` | 47ns | 57ns | 🟢 1.2× faster |
| `selectorFamily(id)` | 236ns | 202ns | 🔴 1.2× slower |
| `set + read 10 selectors` | 6.6µs | 20.2µs | 🟢 3.1× faster |
| `set + read 100 selectorFamily entries` | 66.1µs | 129.6µs | 🟢 2.0× faster |
| `set + read 100 selectors` | 64.9µs | 131.8µs | 🟢 2.0× faster |
| `set + read through 5 chained selectors` | 4.5µs | 10.3µs | 🟢 2.3× faster |
| `set 1000 atoms` | 93.5µs | 428.4µs | 🟢 4.6× faster |
| `set(atom, curr => curr+1)` | 262ns | 1.5µs | 🟢 5.7× faster |
| `set(atom, value)` | 260ns | 1.3µs | 🟢 4.9× faster |
| `set(atom) with 10 subs` | 297ns | 1.7µs | 🟢 5.8× faster |
| `store.get(atom)` | 19ns | 162ns | 🟢 8.5× faster |
| `sub + unsub` | 722ns | 2.1µs | 🟢 2.9× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 127.7µs | 105.2µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 68.4µs | 56.3µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 580.3µs | 514.0µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 108.0µs | 173.6µs | 🟢 1.6× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 78.3µs | 252.8µs | 🟢 3.2× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 758.5µs | 1.36ms | 🟢 1.8× faster |
| `txn: asymmetric DAG shared sink` | 23.2µs | 54.1µs | 🟢 2.3× faster |
| `txn: cross-atom 1000 selectors, set + read` | 941.9µs | 1.95ms | 🟢 2.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 922.9µs | 12.67ms | 🟢 13.7× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.64ms | 9.15ms | 🟢 2.5× faster |

<!-- BENCH:END -->
