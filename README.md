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
| `atom lifecycle (create+100get+100set)` | 11.4µs | 264.4µs | 🟢 23.1× faster |
| `atom(1)` | 2ns | 56ns | 🟢 23.9× faster |
| `atomFamily(id)` | 203ns | 422ns | 🟢 2.1× faster |
| `atomFamily(id) cache hit` | 10ns | 12ns | 🟢 1.2× faster |
| `createStore` | 269ns | 5.1µs | 🟢 19.0× faster |
| `get 1000 atoms` | 10.6µs | 427.2µs | 🟢 40.3× faster |
| `selector(fn)` | 4ns | 60ns | 🟢 14.0× faster |
| `selectorFamily(id)` | 144ns | 264ns | 🟢 1.8× faster |
| `set + read 10 selectors` | 7.4µs | 36.4µs | 🟢 4.9× faster |
| `set + read 100 selectorFamily entries` | 59.9µs | 260.2µs | 🟢 4.3× faster |
| `set + read 100 selectors` | 61.3µs | 343.0µs | 🟢 5.6× faster |
| `set + read through 5 chained selectors` | 5.9µs | 16.9µs | 🟢 2.9× faster |
| `set 1000 atoms` | 97.6µs | 975.3µs | 🟢 10.0× faster |
| `set(atom, curr => curr+1)` | 97ns | 3.0µs | 🟢 31.0× faster |
| `set(atom, value)` | 130ns | 5.0µs | 🟢 38.3× faster |
| `set(atom) with 10 subs` | 162ns | 4.2µs | 🟢 25.7× faster |
| `store.get(atom)` | 40ns | 381ns | 🟢 9.5× faster |
| `sub + unsub` | 434ns | 3.5µs | 🟢 8.2× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 115.9µs | 134.8µs | 🟢 1.2× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 66.3µs | 91.9µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 562.1µs | 645.6µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 78.3µs | 292.1µs | 🟢 3.7× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 82.1µs | 619.4µs | 🟢 7.5× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 679.5µs | 4.12ms | 🟢 6.1× faster |
| `txn: asymmetric DAG shared sink` | 22.7µs | 144.4µs | 🟢 6.4× faster |
| `txn: cross-atom 1000 selectors, set + read` | 883.9µs | 6.76ms | 🟢 7.6× faster |
| `txn: cross-atom 1000 selectors, with subs` | 928.1µs | 23.28ms | 🟢 25.1× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.01ms | 20.28ms | 🟢 5.1× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 22.8µs | 139.2µs | 🟢 6.1× faster |
| `atom(1)` | 27ns | 48ns | 🟢 1.8× faster |
| `atomFamily(id)` | 122ns | 212ns | 🟢 1.7× faster |
| `atomFamily(id) cache hit` | 5ns | 27ns | 🟢 5.4× faster |
| `createStore` | 176ns | 1.9µs | 🟢 10.7× faster |
| `get 1000 atoms` | 15.2µs | 207.4µs | 🟢 13.6× faster |
| `selector(fn)` | 45ns | 56ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 183ns | 196ns | 🟢 1.1× faster |
| `set + read 10 selectors` | 6.5µs | 21.8µs | 🟢 3.3× faster |
| `set + read 100 selectorFamily entries` | 65.0µs | 132.5µs | 🟢 2.0× faster |
| `set + read 100 selectors` | 63.9µs | 131.2µs | 🟢 2.1× faster |
| `set + read through 5 chained selectors` | 4.4µs | 10.1µs | 🟢 2.3× faster |
| `set 1000 atoms` | 79.9µs | 430.6µs | 🟢 5.4× faster |
| `set(atom, curr => curr+1)` | 198ns | 1.5µs | 🟢 7.5× faster |
| `set(atom, value)` | 198ns | 1.2µs | 🟢 6.2× faster |
| `set(atom) with 10 subs` | 233ns | 1.7µs | 🟢 7.5× faster |
| `store.get(atom)` | 19ns | 165ns | 🟢 8.7× faster |
| `sub + unsub` | 746ns | 2.1µs | 🟢 2.8× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 128.0µs | 105.7µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 68.4µs | 55.7µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 579.9µs | 514.6µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 119.2µs | 169.2µs | 🟢 1.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 78.6µs | 249.5µs | 🟢 3.2× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 797.0µs | 1.38ms | 🟢 1.7× faster |
| `txn: asymmetric DAG shared sink` | 22.1µs | 54.3µs | 🟢 2.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 969.4µs | 1.96ms | 🟢 2.0× faster |
| `txn: cross-atom 1000 selectors, with subs` | 921.9µs | 12.79ms | 🟢 13.9× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.61ms | 9.56ms | 🟢 2.6× faster |

<!-- BENCH:END -->
