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
| `atom lifecycle (create+100get+100set)` | 11.7µs | 257.7µs | 🟢 22.1× faster |
| `atom(1)` | 2ns | 54ns | 🟢 22.6× faster |
| `atomFamily(id)` | 173ns | 434ns | 🟢 2.5× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 274ns | 5.3µs | 🟢 19.2× faster |
| `get 1000 atoms` | 10.0µs | 415.2µs | 🟢 41.7× faster |
| `selector(fn)` | 4ns | 62ns | 🟢 14.7× faster |
| `selectorFamily(id)` | 137ns | 183ns | 🟢 1.3× faster |
| `set + read 10 selectors` | 8.5µs | 37.0µs | 🟢 4.3× faster |
| `set + read 100 selectorFamily entries` | 68.7µs | 263.0µs | 🟢 3.8× faster |
| `set + read 100 selectors` | 71.3µs | 348.9µs | 🟢 4.9× faster |
| `set + read through 5 chained selectors` | 6.5µs | 17.8µs | 🟢 2.7× faster |
| `set 1000 atoms` | 101.3µs | 968.0µs | 🟢 9.6× faster |
| `set(atom, curr => curr+1)` | 129ns | 3.3µs | 🟢 25.4× faster |
| `set(atom, value)` | 140ns | 2.5µs | 🟢 17.8× faster |
| `set(atom) with 10 subs` | 153ns | 3.9µs | 🟢 25.3× faster |
| `store.get(atom)` | 40ns | 371ns | 🟢 9.3× faster |
| `sub + unsub` | 479ns | 3.3µs | 🟢 6.8× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 122.3µs | 132.7µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 70.5µs | 95.4µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 554.6µs | 633.2µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 78.9µs | 284.4µs | 🟢 3.6× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 90.5µs | 661.2µs | 🟢 7.3× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 724.6µs | 3.64ms | 🟢 5.0× faster |
| `txn: asymmetric DAG shared sink` | 27.7µs | 151.9µs | 🟢 5.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 884.4µs | 5.28ms | 🟢 6.0× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.51ms | 26.83ms | 🟢 17.8× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.70ms | 22.30ms | 🟢 4.7× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 27.6µs | 143.7µs | 🟢 5.2× faster |
| `atom(1)` | 26ns | 50ns | 🟢 1.9× faster |
| `atomFamily(id)` | 107ns | 233ns | 🟢 2.2× faster |
| `atomFamily(id) cache hit` | 4ns | 30ns | 🟢 6.7× faster |
| `createStore` | 186ns | 1.7µs | 🟢 9.4× faster |
| `get 1000 atoms` | 15.0µs | 206.8µs | 🟢 13.8× faster |
| `selector(fn)` | 45ns | 57ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 149ns | 181ns | 🟢 1.2× faster |
| `set + read 10 selectors` | 7.4µs | 19.7µs | 🟢 2.7× faster |
| `set + read 100 selectorFamily entries` | 75.0µs | 132.6µs | 🟢 1.8× faster |
| `set + read 100 selectors` | 75.2µs | 131.4µs | 🟢 1.7× faster |
| `set + read through 5 chained selectors` | 4.7µs | 9.7µs | 🟢 2.1× faster |
| `set 1000 atoms` | 91.3µs | 446.6µs | 🟢 4.9× faster |
| `set(atom, curr => curr+1)` | 254ns | 1.5µs | 🟢 5.9× faster |
| `set(atom, value)` | 264ns | 1.3µs | 🟢 4.8× faster |
| `set(atom) with 10 subs` | 307ns | 1.7µs | 🟢 5.5× faster |
| `store.get(atom)` | 18ns | 161ns | 🟢 8.9× faster |
| `sub + unsub` | 845ns | 2.1µs | 🟢 2.5× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 134.1µs | 106.6µs | 🔴 1.3× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 72.3µs | 55.8µs | 🔴 1.3× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 617.6µs | 525.6µs | 🔴 1.2× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 126.9µs | 172.9µs | 🟢 1.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 83.6µs | 257.3µs | 🟢 3.1× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 832.7µs | 1.39ms | 🟢 1.7× faster |
| `txn: asymmetric DAG shared sink` | 24.6µs | 54.7µs | 🟢 2.2× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.01ms | 1.93ms | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 985.1µs | 12.24ms | 🟢 12.4× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.78ms | 9.80ms | 🟢 2.6× faster |

<!-- BENCH:END -->
