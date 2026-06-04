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
| `atom lifecycle (create+100get+100set)` | 11.5µs | 271.0µs | 🟢 23.6× faster |
| `atom(1)` | 2ns | 56ns | 🟢 24.1× faster |
| `atomFamily(id)` | 229ns | 449ns | 🟢 2.0× faster |
| `atomFamily(id) cache hit` | 10ns | 12ns | 🟢 1.2× faster |
| `createStore` | 273ns | 5.1µs | 🟢 18.7× faster |
| `get 1000 atoms` | 11.3µs | 372.4µs | 🟢 32.9× faster |
| `selector(fn)` | 5ns | 60ns | 🟢 12.9× faster |
| `selectorFamily(id)` | 207ns | 506ns | 🟢 2.4× faster |
| `set + read 10 selectors` | 7.4µs | 38.0µs | 🟢 5.2× faster |
| `set + read 100 selectorFamily entries` | 60.1µs | 350.9µs | 🟢 5.8× faster |
| `set + read 100 selectors` | 57.3µs | 277.8µs | 🟢 4.8× faster |
| `set + read through 5 chained selectors` | 5.3µs | 14.6µs | 🟢 2.7× faster |
| `set 1000 atoms` | 98.8µs | 902.5µs | 🟢 9.1× faster |
| `set(atom, curr => curr+1)` | 95ns | 3.4µs | 🟢 36.1× faster |
| `set(atom, value)` | 140ns | 2.2µs | 🟢 15.5× faster |
| `set(atom) with 10 subs` | 137ns | 4.5µs | 🟢 32.7× faster |
| `store.get(atom)` | 40ns | 381ns | 🟢 9.5× faster |
| `sub + unsub` | 324ns | 2.9µs | 🟢 9.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 114.9µs | 177.4µs | 🟢 1.5× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 64.3µs | 95.4µs | 🟢 1.5× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 536.0µs | 857.6µs | 🟢 1.6× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 62.2µs | 372.8µs | 🟢 6.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 78.2µs | 578.7µs | 🟢 7.4× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 643.2µs | 3.61ms | 🟢 5.6× faster |
| `txn: asymmetric DAG shared sink` | 22.3µs | 136.4µs | 🟢 6.1× faster |
| `txn: cross-atom 1000 selectors, set + read` | 803.0µs | 3.83ms | 🟢 4.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 970.8µs | 20.67ms | 🟢 21.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.91ms | 14.68ms | 🟢 3.8× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 25.2µs | 136.8µs | 🟢 5.4× faster |
| `atom(1)` | 28ns | 47ns | 🟢 1.7× faster |
| `atomFamily(id)` | 136ns | 410ns | 🟢 3.0× faster |
| `atomFamily(id) cache hit` | 5ns | 27ns | 🟢 5.5× faster |
| `createStore` | 175ns | 1.8µs | 🟢 10.1× faster |
| `get 1000 atoms` | 15.1µs | 207.6µs | 🟢 13.7× faster |
| `selector(fn)` | 43ns | 53ns | 🟢 1.2× faster |
| `selectorFamily(id)` | 229ns | 258ns | 🟢 1.1× faster |
| `set + read 10 selectors` | 7.5µs | 22.3µs | 🟢 3.0× faster |
| `set + read 100 selectorFamily entries` | 65.8µs | 129.5µs | 🟢 2.0× faster |
| `set + read 100 selectors` | 64.3µs | 128.8µs | 🟢 2.0× faster |
| `set + read through 5 chained selectors` | 4.7µs | 10.1µs | 🟢 2.2× faster |
| `set 1000 atoms` | 80.2µs | 423.2µs | 🟢 5.3× faster |
| `set(atom, curr => curr+1)` | 203ns | 1.5µs | 🟢 7.3× faster |
| `set(atom, value)` | 200ns | 1.2µs | 🟢 6.0× faster |
| `set(atom) with 10 subs` | 253ns | 1.7µs | 🟢 6.7× faster |
| `store.get(atom)` | 15ns | 162ns | 🟢 11.0× faster |
| `sub + unsub` | 730ns | 2.1µs | 🟢 2.9× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 127.1µs | 105.0µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 68.1µs | 55.8µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 579.4µs | 521.5µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 69.6µs | 147.0µs | 🟢 2.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 73.8µs | 240.6µs | 🟢 3.3× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 791.1µs | 1.31ms | 🟢 1.7× faster |
| `txn: asymmetric DAG shared sink` | 21.7µs | 54.0µs | 🟢 2.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 977.1µs | 1.83ms | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 932.4µs | 12.35ms | 🟢 13.2× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.57ms | 9.04ms | 🟢 2.5× faster |

<!-- BENCH:END -->
