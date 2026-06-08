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
| `atom lifecycle (create+100get+100set)` | 12.3µs | 256.7µs | 🟢 20.9× faster |
| `atom(1)` | 2ns | 53ns | 🟢 23.5× faster |
| `atomFamily(id)` | 172ns | 373ns | 🟢 2.2× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 290ns | 6.5µs | 🟢 22.4× faster |
| `get 1000 atoms` | 12.1µs | 560.8µs | 🟢 46.2× faster |
| `selector(fn)` | 4ns | 56ns | 🟢 14.9× faster |
| `selectorFamily(id)` | 141ns | 187ns | 🟢 1.3× faster |
| `set + read 10 selectors` | 8.0µs | 36.9µs | 🟢 4.6× faster |
| `set + read 100 selectorFamily entries` | 66.9µs | 266.7µs | 🟢 4.0× faster |
| `set + read 100 selectors` | 65.0µs | 345.0µs | 🟢 5.3× faster |
| `set + read through 5 chained selectors` | 6.5µs | 16.8µs | 🟢 2.6× faster |
| `set 1000 atoms` | 112.8µs | 981.5µs | 🟢 8.7× faster |
| `set(atom, curr => curr+1)` | 156ns | 3.5µs | 🟢 22.7× faster |
| `set(atom, value)` | 127ns | 4.3µs | 🟢 33.6× faster |
| `set(atom) with 10 subs` | 147ns | 4.1µs | 🟢 27.5× faster |
| `store.get(atom)` | 40ns | 371ns | 🟢 9.3× faster |
| `sub + unsub` | 519ns | 3.2µs | 🟢 6.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 118.5µs | 134.2µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 67.5µs | 95.1µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 550.1µs | 640.6µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 73.0µs | 282.6µs | 🟢 3.9× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 85.8µs | 657.7µs | 🟢 7.7× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 717.4µs | 3.70ms | 🟢 5.2× faster |
| `txn: asymmetric DAG shared sink` | 23.1µs | 149.9µs | 🟢 6.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 875.5µs | 5.35ms | 🟢 6.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.07ms | 22.71ms | 🟢 21.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.97ms | 20.24ms | 🟢 5.1× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 27.6µs | 139.6µs | 🟢 5.1× faster |
| `atom(1)` | 26ns | 53ns | 🟢 2.1× faster |
| `atomFamily(id)` | 133ns | 217ns | 🟢 1.6× faster |
| `atomFamily(id) cache hit` | 5ns | 26ns | 🟢 5.8× faster |
| `createStore` | 287ns | 1.6µs | 🟢 5.6× faster |
| `get 1000 atoms` | 15.1µs | 210.3µs | 🟢 13.9× faster |
| `selector(fn)` | 41ns | 58ns | 🟢 1.4× faster |
| `selectorFamily(id)` | 151ns | 221ns | 🟢 1.5× faster |
| `set + read 10 selectors` | 7.3µs | 19.0µs | 🟢 2.6× faster |
| `set + read 100 selectorFamily entries` | 73.8µs | 129.4µs | 🟢 1.8× faster |
| `set + read 100 selectors` | 72.8µs | 128.1µs | 🟢 1.8× faster |
| `set + read through 5 chained selectors` | 4.7µs | 9.6µs | 🟢 2.1× faster |
| `set 1000 atoms` | 90.1µs | 450.8µs | 🟢 5.0× faster |
| `set(atom, curr => curr+1)` | 268ns | 1.5µs | 🟢 5.5× faster |
| `set(atom, value)` | 275ns | 1.2µs | 🟢 4.5× faster |
| `set(atom) with 10 subs` | 292ns | 1.7µs | 🟢 5.9× faster |
| `store.get(atom)` | 32ns | 169ns | 🟢 5.3× faster |
| `sub + unsub` | 826ns | 2.1µs | 🟢 2.5× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 129.7µs | 107.0µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 68.9µs | 56.5µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 588.5µs | 617.7µs | 🟢 1.0× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 88.5µs | 172.8µs | 🟢 2.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 85.4µs | 255.9µs | 🟢 3.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 813.2µs | 1.33ms | 🟢 1.6× faster |
| `txn: asymmetric DAG shared sink` | 25.1µs | 53.0µs | 🟢 2.1× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.01ms | 1.87ms | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 979.5µs | 11.98ms | 🟢 12.2× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.72ms | 9.39ms | 🟢 2.5× faster |

<!-- BENCH:END -->
