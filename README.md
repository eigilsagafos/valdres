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
| `atom lifecycle (create+100get+100set)` | 11.9µs | 266.3µs | 🟢 22.5× faster |
| `atom(1)` | 2ns | 93ns | 🟢 39.9× faster |
| `atomFamily(id)` | 204ns | 390ns | 🟢 1.9× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 252ns | 5.4µs | 🟢 21.4× faster |
| `get 1000 atoms` | 9.9µs | 401.7µs | 🟢 40.4× faster |
| `selector(fn)` | 4ns | 59ns | 🟢 14.8× faster |
| `selectorFamily(id)` | 149ns | 208ns | 🟢 1.4× faster |
| `set + read 10 selectors` | 8.1µs | 37.8µs | 🟢 4.7× faster |
| `set + read 100 selectorFamily entries` | 66.4µs | 273.3µs | 🟢 4.1× faster |
| `set + read 100 selectors` | 68.7µs | 359.9µs | 🟢 5.2× faster |
| `set + read through 5 chained selectors` | 6.5µs | 19.0µs | 🟢 2.9× faster |
| `set 1000 atoms` | 107.9µs | 981.3µs | 🟢 9.1× faster |
| `set(atom, curr => curr+1)` | 102ns | 4.0µs | 🟢 39.3× faster |
| `set(atom, value)` | 140ns | 4.6µs | 🟢 32.6× faster |
| `set(atom) with 10 subs` | 141ns | 4.9µs | 🟢 34.5× faster |
| `store.get(atom)` | 40ns | 371ns | 🟢 9.3× faster |
| `sub + unsub` | 479ns | 3.4µs | 🟢 7.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 126.2µs | 135.5µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 71.1µs | 98.7µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 573.2µs | 648.1µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 72.6µs | 296.7µs | 🟢 4.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 88.7µs | 654.2µs | 🟢 7.4× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 702.7µs | 4.83ms | 🟢 6.9× faster |
| `txn: asymmetric DAG shared sink` | 28.7µs | 162.3µs | 🟢 5.7× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.09ms | 5.50ms | 🟢 5.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.40ms | 27.76ms | 🟢 19.9× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 6.40ms | 24.07ms | 🟢 3.8× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 23.7µs | 144.3µs | 🟢 6.1× faster |
| `atom(1)` | 26ns | 51ns | 🟢 2.0× faster |
| `atomFamily(id)` | 109ns | 302ns | 🟢 2.8× faster |
| `atomFamily(id) cache hit` | 7ns | 27ns | 🟢 4.0× faster |
| `createStore` | 188ns | 1.8µs | 🟢 9.3× faster |
| `get 1000 atoms` | 14.9µs | 207.9µs | 🟢 13.9× faster |
| `selector(fn)` | 44ns | 57ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 158ns | 233ns | 🟢 1.5× faster |
| `set + read 10 selectors` | 7.4µs | 19.9µs | 🟢 2.7× faster |
| `set + read 100 selectorFamily entries` | 74.8µs | 132.9µs | 🟢 1.8× faster |
| `set + read 100 selectors` | 76.6µs | 132.8µs | 🟢 1.7× faster |
| `set + read through 5 chained selectors` | 4.6µs | 10.1µs | 🟢 2.2× faster |
| `set 1000 atoms` | 80.7µs | 447.0µs | 🟢 5.5× faster |
| `set(atom, curr => curr+1)` | 208ns | 1.5µs | 🟢 7.3× faster |
| `set(atom, value)` | 217ns | 1.3µs | 🟢 5.9× faster |
| `set(atom) with 10 subs` | 256ns | 1.8µs | 🟢 6.9× faster |
| `store.get(atom)` | 18ns | 160ns | 🟢 8.9× faster |
| `sub + unsub` | 875ns | 2.1µs | 🟢 2.5× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 129.0µs | 111.6µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 69.5µs | 58.3µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 586.0µs | 546.1µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 121.5µs | 170.2µs | 🟢 1.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 87.3µs | 263.2µs | 🟢 3.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 852.6µs | 1.38ms | 🟢 1.6× faster |
| `txn: asymmetric DAG shared sink` | 26.9µs | 55.7µs | 🟢 2.1× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.05ms | 1.93ms | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 985.1µs | 12.29ms | 🟢 12.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.85ms | 9.44ms | 🟢 2.5× faster |

<!-- BENCH:END -->
