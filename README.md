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
| `atom lifecycle (create+100get+100set)` | 11.7µs | 264.1µs | 🟢 22.7× faster |
| `atom(1)` | 2ns | 53ns | 🟢 22.1× faster |
| `atomFamily(id)` | 181ns | 393ns | 🟢 2.2× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 258ns | 5.4µs | 🟢 21.0× faster |
| `get 1000 atoms` | 9.9µs | 407.2µs | 🟢 41.3× faster |
| `selector(fn)` | 4ns | 102ns | 🟢 23.8× faster |
| `selectorFamily(id)` | 138ns | 258ns | 🟢 1.9× faster |
| `set + read 10 selectors` | 8.2µs | 37.1µs | 🟢 4.5× faster |
| `set + read 100 selectorFamily entries` | 68.9µs | 268.4µs | 🟢 3.9× faster |
| `set + read 100 selectors` | 68.5µs | 358.3µs | 🟢 5.2× faster |
| `set + read through 5 chained selectors` | 5.3µs | 18.9µs | 🟢 3.6× faster |
| `set 1000 atoms` | 109.9µs | 993.1µs | 🟢 9.0× faster |
| `set(atom, curr => curr+1)` | 101ns | 3.2µs | 🟢 31.8× faster |
| `set(atom, value)` | 130ns | 4.8µs | 🟢 37.1× faster |
| `set(atom) with 10 subs` | 143ns | 4.1µs | 🟢 28.6× faster |
| `store.get(atom)` | 40ns | 371ns | 🟢 9.3× faster |
| `sub + unsub` | 518ns | 3.3µs | 🟢 6.3× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 124.1µs | 135.3µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 70.1µs | 97.8µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 557.3µs | 638.6µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 74.8µs | 293.5µs | 🟢 3.9× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 88.5µs | 656.5µs | 🟢 7.4× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 741.4µs | 3.65ms | 🟢 4.9× faster |
| `txn: asymmetric DAG shared sink` | 28.6µs | 156.7µs | 🟢 5.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 797.5µs | 5.49ms | 🟢 6.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.05ms | 24.03ms | 🟢 22.9× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.49ms | 21.88ms | 🟢 4.9× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 25.0µs | 142.8µs | 🟢 5.7× faster |
| `atom(1)` | 26ns | 49ns | 🟢 1.9× faster |
| `atomFamily(id)` | 111ns | 257ns | 🟢 2.3× faster |
| `atomFamily(id) cache hit` | 4ns | 26ns | 🟢 6.0× faster |
| `createStore` | 181ns | 1.6µs | 🟢 8.7× faster |
| `get 1000 atoms` | 14.6µs | 212.9µs | 🟢 14.6× faster |
| `selector(fn)` | 44ns | 113ns | 🟢 2.6× faster |
| `selectorFamily(id)` | 156ns | 193ns | 🟢 1.2× faster |
| `set + read 10 selectors` | 8.3µs | 21.4µs | 🟢 2.6× faster |
| `set + read 100 selectorFamily entries` | 74.5µs | 130.5µs | 🟢 1.8× faster |
| `set + read 100 selectors` | 75.4µs | 129.1µs | 🟢 1.7× faster |
| `set + read through 5 chained selectors` | 5.0µs | 9.7µs | 🟢 1.9× faster |
| `set 1000 atoms` | 84.0µs | 458.4µs | 🟢 5.5× faster |
| `set(atom, curr => curr+1)` | 214ns | 1.5µs | 🟢 6.9× faster |
| `set(atom, value)` | 210ns | 1.2µs | 🟢 5.8× faster |
| `set(atom) with 10 subs` | 276ns | 1.7µs | 🟢 6.2× faster |
| `store.get(atom)` | 18ns | 163ns | 🟢 9.0× faster |
| `sub + unsub` | 859ns | 2.1µs | 🟢 2.4× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 134.6µs | 107.6µs | 🔴 1.3× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 71.7µs | 66.7µs | 🔴 1.1× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 608.3µs | 523.9µs | 🔴 1.2× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 113.5µs | 175.4µs | 🟢 1.5× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 82.8µs | 254.4µs | 🟢 3.1× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 801.4µs | 1.34ms | 🟢 1.7× faster |
| `txn: asymmetric DAG shared sink` | 25.6µs | 55.0µs | 🟢 2.2× faster |
| `txn: cross-atom 1000 selectors, set + read` | 999.8µs | 1.84ms | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 946.9µs | 12.94ms | 🟢 13.7× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.79ms | 9.71ms | 🟢 2.6× faster |

<!-- BENCH:END -->
