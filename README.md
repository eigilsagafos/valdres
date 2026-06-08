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
| `atom lifecycle (create+100get+100set)` | 12.1µs | 262.7µs | 🟢 21.8× faster |
| `atom(1)` | 4ns | 54ns | 🟢 14.1× faster |
| `atomFamily(id)` | 174ns | 381ns | 🟢 2.2× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 275ns | 5.3µs | 🟢 19.3× faster |
| `get 1000 atoms` | 10.0µs | 402.0µs | 🟢 40.1× faster |
| `selector(fn)` | 4ns | 58ns | 🟢 13.4× faster |
| `selectorFamily(id)` | 135ns | 196ns | 🟢 1.5× faster |
| `set + read 10 selectors` | 8.4µs | 37.9µs | 🟢 4.5× faster |
| `set + read 100 selectorFamily entries` | 68.0µs | 272.5µs | 🟢 4.0× faster |
| `set + read 100 selectors` | 68.3µs | 361.8µs | 🟢 5.3× faster |
| `set + read through 5 chained selectors` | 6.7µs | 18.3µs | 🟢 2.7× faster |
| `set 1000 atoms` | 107.7µs | 967.7µs | 🟢 9.0× faster |
| `set(atom, curr => curr+1)` | 136ns | 3.3µs | 🟢 24.1× faster |
| `set(atom, value)` | 140ns | 4.6µs | 🟢 32.9× faster |
| `set(atom) with 10 subs` | 146ns | 4.1µs | 🟢 27.9× faster |
| `store.get(atom)` | 40ns | 371ns | 🟢 9.3× faster |
| `sub + unsub` | 467ns | 3.7µs | 🟢 7.9× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 123.6µs | 141.7µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 70.7µs | 98.7µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 558.4µs | 660.1µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 82.9µs | 405.4µs | 🟢 4.9× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 88.8µs | 675.5µs | 🟢 7.6× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 768.7µs | 4.31ms | 🟢 5.6× faster |
| `txn: asymmetric DAG shared sink` | 24.1µs | 156.3µs | 🟢 6.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.05ms | 6.52ms | 🟢 6.2× faster |
| `txn: cross-atom 1000 selectors, with subs` | 958.4µs | 23.72ms | 🟢 24.8× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.08ms | 20.28ms | 🟢 5.0× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 29.1µs | 140.9µs | 🟢 4.8× faster |
| `atom(1)` | 26ns | 50ns | 🟢 1.9× faster |
| `atomFamily(id)` | 109ns | 231ns | 🟢 2.1× faster |
| `atomFamily(id) cache hit` | 3ns | 26ns | 🟢 7.8× faster |
| `createStore` | 195ns | 1.9µs | 🟢 9.6× faster |
| `get 1000 atoms` | 15.0µs | 208.4µs | 🟢 13.9× faster |
| `selector(fn)` | 43ns | 58ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 151ns | 187ns | 🟢 1.2× faster |
| `set + read 10 selectors` | 7.5µs | 19.1µs | 🟢 2.5× faster |
| `set + read 100 selectorFamily entries` | 74.6µs | 130.1µs | 🟢 1.7× faster |
| `set + read 100 selectors` | 72.8µs | 129.1µs | 🟢 1.8× faster |
| `set + read through 5 chained selectors` | 4.6µs | 9.7µs | 🟢 2.1× faster |
| `set 1000 atoms` | 97.4µs | 448.2µs | 🟢 4.6× faster |
| `set(atom, curr => curr+1)` | 280ns | 1.5µs | 🟢 5.3× faster |
| `set(atom, value)` | 257ns | 1.3µs | 🟢 5.0× faster |
| `set(atom) with 10 subs` | 299ns | 1.7µs | 🟢 5.7× faster |
| `store.get(atom)` | 18ns | 161ns | 🟢 8.9× faster |
| `sub + unsub` | 778ns | 2.1µs | 🟢 2.7× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 128.5µs | 107.6µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 69.7µs | 56.7µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 583.1µs | 533.5µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 124.7µs | 170.4µs | 🟢 1.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 86.3µs | 254.0µs | 🟢 2.9× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 805.3µs | 1.36ms | 🟢 1.7× faster |
| `txn: asymmetric DAG shared sink` | 24.4µs | 54.4µs | 🟢 2.2× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.02ms | 1.90ms | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 969.5µs | 12.12ms | 🟢 12.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.71ms | 9.36ms | 🟢 2.5× faster |

<!-- BENCH:END -->
