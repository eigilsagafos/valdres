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
| `atom lifecycle (create+100get+100set)` | 11.4µs | 287.9µs | 🟢 25.2× faster |
| `atom(1)` | 2ns | 57ns | 🟢 24.3× faster |
| `atomFamily(id)` | 171ns | 460ns | 🟢 2.7× faster |
| `atomFamily(id) cache hit` | 10ns | 12ns | 🟢 1.2× faster |
| `createStore` | 348ns | 5.7µs | 🟢 16.3× faster |
| `get 1000 atoms` | 10.3µs | 419.4µs | 🟢 40.7× faster |
| `selector(fn)` | 5ns | 61ns | 🟢 12.4× faster |
| `selectorFamily(id)` | 221ns | 291ns | 🟢 1.3× faster |
| `set + read 10 selectors` | 7.4µs | 37.4µs | 🟢 5.1× faster |
| `set + read 100 selectorFamily entries` | 59.8µs | 270.3µs | 🟢 4.5× faster |
| `set + read 100 selectors` | 60.1µs | 347.0µs | 🟢 5.8× faster |
| `set + read through 5 chained selectors` | 6.0µs | 18.8µs | 🟢 3.2× faster |
| `set 1000 atoms` | 97.3µs | 945.2µs | 🟢 9.7× faster |
| `set(atom, curr => curr+1)` | 98ns | 3.3µs | 🟢 33.8× faster |
| `set(atom, value)` | 119ns | 4.8µs | 🟢 40.5× faster |
| `set(atom) with 10 subs` | 139ns | 4.2µs | 🟢 30.4× faster |
| `store.get(atom)` | 40ns | 381ns | 🟢 9.5× faster |
| `sub + unsub` | 643ns | 3.4µs | 🟢 5.3× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 118.6µs | 137.6µs | 🟢 1.2× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 68.0µs | 93.7µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 645.5µs | 660.0µs | 🟢 1.0× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 64.7µs | 288.2µs | 🟢 4.5× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 77.9µs | 625.0µs | 🟢 8.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 663.1µs | 3.66ms | 🟢 5.5× faster |
| `txn: asymmetric DAG shared sink` | 26.4µs | 148.7µs | 🟢 5.6× faster |
| `txn: cross-atom 1000 selectors, set + read` | 852.6µs | 5.27ms | 🟢 6.2× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.01ms | 24.56ms | 🟢 24.2× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.60ms | 21.00ms | 🟢 4.6× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 25.5µs | 144.3µs | 🟢 5.7× faster |
| `atom(1)` | 28ns | 51ns | 🟢 1.8× faster |
| `atomFamily(id)` | 122ns | 209ns | 🟢 1.7× faster |
| `atomFamily(id) cache hit` | 5ns | 28ns | 🟢 5.8× faster |
| `createStore` | 205ns | 1.9µs | 🟢 9.1× faster |
| `get 1000 atoms` | 15.2µs | 209.0µs | 🟢 13.8× faster |
| `selector(fn)` | 45ns | 61ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 197ns | 220ns | 🟢 1.1× faster |
| `set + read 10 selectors` | 7.5µs | 23.0µs | 🟢 3.1× faster |
| `set + read 100 selectorFamily entries` | 68.3µs | 133.4µs | 🟢 2.0× faster |
| `set + read 100 selectors` | 65.5µs | 134.0µs | 🟢 2.0× faster |
| `set + read through 5 chained selectors` | 4.8µs | 10.1µs | 🟢 2.1× faster |
| `set 1000 atoms` | 90.7µs | 418.2µs | 🟢 4.6× faster |
| `set(atom, curr => curr+1)` | 244ns | 1.5µs | 🟢 6.2× faster |
| `set(atom, value)` | 235ns | 1.3µs | 🟢 5.5× faster |
| `set(atom) with 10 subs` | 283ns | 1.8µs | 🟢 6.3× faster |
| `store.get(atom)` | 19ns | 163ns | 🟢 8.6× faster |
| `sub + unsub` | 699ns | 2.1µs | 🟢 3.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 129.6µs | 106.3µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 69.4µs | 57.2µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 585.7µs | 521.9µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 117.8µs | 176.5µs | 🟢 1.5× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 74.4µs | 256.3µs | 🟢 3.4× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 781.4µs | 1.39ms | 🟢 1.8× faster |
| `txn: asymmetric DAG shared sink` | 22.1µs | 54.5µs | 🟢 2.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 946.2µs | 2.06ms | 🟢 2.2× faster |
| `txn: cross-atom 1000 selectors, with subs` | 919.1µs | 13.09ms | 🟢 14.2× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.51ms | 9.57ms | 🟢 2.7× faster |

<!-- BENCH:END -->
