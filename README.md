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
| `atom lifecycle (create+100get+100set)` | 11.9µs | 275.2µs | 🟢 23.1× faster |
| `atom(1)` | 2ns | 58ns | 🟢 24.5× faster |
| `atomFamily(id)` | 143ns | 456ns | 🟢 3.2× faster |
| `atomFamily(id) cache hit` | 10ns | 12ns | 🟢 1.1× faster |
| `createStore` | 401ns | 5.3µs | 🟢 13.1× faster |
| `get 1000 atoms` | 10.6µs | 420.3µs | 🟢 39.7× faster |
| `selector(fn)` | 5ns | 62ns | 🟢 11.7× faster |
| `selectorFamily(id)` | 180ns | 323ns | 🟢 1.8× faster |
| `set + read 10 selectors` | 7.9µs | 36.9µs | 🟢 4.7× faster |
| `set + read 100 selectorFamily entries` | 63.6µs | 276.1µs | 🟢 4.3× faster |
| `set + read 100 selectors` | 61.1µs | 344.0µs | 🟢 5.6× faster |
| `set + read through 5 chained selectors` | 6.7µs | 19.5µs | 🟢 2.9× faster |
| `set 1000 atoms` | 96.2µs | 995.0µs | 🟢 10.3× faster |
| `set(atom, curr => curr+1)` | 125ns | 3.2µs | 🟢 25.5× faster |
| `set(atom, value)` | 140ns | 2.8µs | 🟢 20.2× faster |
| `set(atom) with 10 subs` | 145ns | 4.2µs | 🟢 28.8× faster |
| `store.get(atom)` | 40ns | 390ns | 🟢 9.8× faster |
| `sub + unsub` | 413ns | 3.4µs | 🟢 8.3× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 157.2µs | 142.5µs | 🔴 1.1× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 66.5µs | 96.6µs | 🟢 1.5× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 639.1µs | 702.8µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 68.3µs | 284.8µs | 🟢 4.2× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 77.4µs | 617.8µs | 🟢 8.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 697.0µs | 3.61ms | 🟢 5.2× faster |
| `txn: asymmetric DAG shared sink` | 25.0µs | 150.4µs | 🟢 6.0× faster |
| `txn: cross-atom 1000 selectors, set + read` | 849.3µs | 5.32ms | 🟢 6.3× faster |
| `txn: cross-atom 1000 selectors, with subs` | 967.8µs | 24.42ms | 🟢 25.2× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.54ms | 23.47ms | 🟢 5.2× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 27.8µs | 140.6µs | 🟢 5.1× faster |
| `atom(1)` | 29ns | 52ns | 🟢 1.8× faster |
| `atomFamily(id)` | 144ns | 255ns | 🟢 1.8× faster |
| `atomFamily(id) cache hit` | 5ns | 27ns | 🟢 5.5× faster |
| `createStore` | 291ns | 1.7µs | 🟢 5.7× faster |
| `get 1000 atoms` | 15.2µs | 205.7µs | 🟢 13.5× faster |
| `selector(fn)` | 44ns | 57ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 202ns | 219ns | 🟢 1.1× faster |
| `set + read 10 selectors` | 6.7µs | 20.1µs | 🟢 3.0× faster |
| `set + read 100 selectorFamily entries` | 65.9µs | 133.6µs | 🟢 2.0× faster |
| `set + read 100 selectors` | 65.4µs | 133.2µs | 🟢 2.0× faster |
| `set + read through 5 chained selectors` | 4.7µs | 10.4µs | 🟢 2.2× faster |
| `set 1000 atoms` | 91.6µs | 418.5µs | 🟢 4.6× faster |
| `set(atom, curr => curr+1)` | 253ns | 1.5µs | 🟢 5.8× faster |
| `set(atom, value)` | 249ns | 1.2µs | 🟢 4.9× faster |
| `set(atom) with 10 subs` | 291ns | 1.7µs | 🟢 5.9× faster |
| `store.get(atom)` | 15ns | 165ns | 🟢 11.2× faster |
| `sub + unsub` | 772ns | 2.2µs | 🟢 2.8× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 127.4µs | 108.0µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 68.0µs | 56.7µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 579.6µs | 536.0µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 125.4µs | 172.9µs | 🟢 1.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 77.8µs | 262.5µs | 🟢 3.4× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 786.9µs | 1.43ms | 🟢 1.8× faster |
| `txn: asymmetric DAG shared sink` | 24.1µs | 55.2µs | 🟢 2.3× faster |
| `txn: cross-atom 1000 selectors, set + read` | 969.4µs | 1.96ms | 🟢 2.0× faster |
| `txn: cross-atom 1000 selectors, with subs` | 948.3µs | 12.46ms | 🟢 13.1× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.62ms | 9.30ms | 🟢 2.6× faster |

<!-- BENCH:END -->
