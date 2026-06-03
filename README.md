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
| `atom lifecycle (create+100get+100set)` | 11.4µs | 264.7µs | 🟢 23.2× faster |
| `atom(1)` | 2ns | 57ns | 🟢 23.4× faster |
| `atomFamily(id)` | 262ns | 437ns | 🟢 1.7× faster |
| `atomFamily(id) cache hit` | 31ns | 12ns | 🔴 2.7× slower |
| `createStore` | 273ns | 5.1µs | 🟢 18.7× faster |
| `get 1000 atoms` | 10.2µs | 634.5µs | 🟢 62.2× faster |
| `selector(fn)` | 4ns | 60ns | 🟢 13.4× faster |
| `selectorFamily(id)` | 201ns | 488ns | 🟢 2.4× faster |
| `set + read 10 selectors` | 7.2µs | 36.5µs | 🟢 5.1× faster |
| `set + read 100 selectorFamily entries` | 64.7µs | 265.5µs | 🟢 4.1× faster |
| `set + read 100 selectors` | 95.8µs | 350.4µs | 🟢 3.7× faster |
| `set + read through 5 chained selectors` | 5.5µs | 17.6µs | 🟢 3.2× faster |
| `set 1000 atoms` | 99.2µs | 905.4µs | 🟢 9.1× faster |
| `set(atom, curr => curr+1)` | 94ns | 3.0µs | 🟢 31.8× faster |
| `set(atom, value)` | 140ns | 2.2µs | 🟢 15.5× faster |
| `set(atom) with 10 subs` | 144ns | 4.2µs | 🟢 28.9× faster |
| `store.get(atom)` | 40ns | 390ns | 🟢 9.8× faster |
| `sub + unsub` | 350ns | 3.3µs | 🟢 9.3× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 120.7µs | 151.0µs | 🟢 1.3× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 70.4µs | 101.8µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 565.4µs | 657.7µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 62.1µs | 282.0µs | 🟢 4.5× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 80.0µs | 535.4µs | 🟢 6.7× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 618.0µs | 3.55ms | 🟢 5.7× faster |
| `txn: asymmetric DAG shared sink` | 23.5µs | 115.1µs | 🟢 4.9× faster |
| `txn: cross-atom 1000 selectors, set + read` | 775.1µs | 3.64ms | 🟢 4.7× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.03ms | 20.80ms | 🟢 20.2× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.25ms | 16.40ms | 🟢 3.9× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 23.5µs | 138.6µs | 🟢 5.9× faster |
| `atom(1)` | 28ns | 48ns | 🟢 1.7× faster |
| `atomFamily(id)` | 250ns | 379ns | 🟢 1.5× faster |
| `atomFamily(id) cache hit` | 33ns | 12ns | 🔴 2.7× slower |
| `createStore` | 177ns | 2.0µs | 🟢 11.1× faster |
| `get 1000 atoms` | 15.1µs | 210.0µs | 🟢 13.9× faster |
| `selector(fn)` | 47ns | 53ns | 🟢 1.1× faster |
| `selectorFamily(id)` | 214ns | 421ns | 🟢 2.0× faster |
| `set + read 10 selectors` | 7.5µs | 21.6µs | 🟢 2.9× faster |
| `set + read 100 selectorFamily entries` | 67.2µs | 131.1µs | 🟢 2.0× faster |
| `set + read 100 selectors` | 66.4µs | 129.1µs | 🟢 1.9× faster |
| `set + read through 5 chained selectors` | 5.4µs | 10.5µs | 🟢 2.0× faster |
| `set 1000 atoms` | 82.1µs | 429.5µs | 🟢 5.2× faster |
| `set(atom, curr => curr+1)` | 200ns | 1.4µs | 🟢 7.2× faster |
| `set(atom, value)` | 199ns | 1.2µs | 🟢 6.0× faster |
| `set(atom) with 10 subs` | 232ns | 1.7µs | 🟢 7.5× faster |
| `store.get(atom)` | 16ns | 200ns | 🟢 12.4× faster |
| `sub + unsub` | 735ns | 2.3µs | 🟢 3.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 166.0µs | 104.6µs | 🔴 1.6× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 88.6µs | 55.1µs | 🔴 1.6× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 773.5µs | 529.0µs | 🔴 1.5× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 65.9µs | 148.3µs | 🟢 2.3× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 73.2µs | 243.0µs | 🟢 3.3× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 752.6µs | 1.35ms | 🟢 1.8× faster |
| `txn: asymmetric DAG shared sink` | 21.8µs | 53.7µs | 🟢 2.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 930.8µs | 1.83ms | 🟢 2.0× faster |
| `txn: cross-atom 1000 selectors, with subs` | 991.9µs | 13.23ms | 🟢 13.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.75ms | 9.76ms | 🟢 2.6× faster |

<!-- BENCH:END -->
