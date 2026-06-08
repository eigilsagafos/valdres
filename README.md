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
| `atom lifecycle (create+100get+100set)` | 11.7µs | 269.3µs | 🟢 22.9× faster |
| `atom(1)` | 2ns | 58ns | 🟢 24.4× faster |
| `atomFamily(id)` | 203ns | 428ns | 🟢 2.1× faster |
| `atomFamily(id) cache hit` | 10ns | 12ns | 🟢 1.2× faster |
| `createStore` | 283ns | 5.2µs | 🟢 18.4× faster |
| `get 1000 atoms` | 11.2µs | 631.8µs | 🟢 56.6× faster |
| `selector(fn)` | 5ns | 62ns | 🟢 12.2× faster |
| `selectorFamily(id)` | 153ns | 212ns | 🟢 1.4× faster |
| `set + read 10 selectors` | 7.1µs | 37.1µs | 🟢 5.2× faster |
| `set + read 100 selectorFamily entries` | 59.4µs | 271.2µs | 🟢 4.6× faster |
| `set + read 100 selectors` | 58.4µs | 349.9µs | 🟢 6.0× faster |
| `set + read through 5 chained selectors` | 6.2µs | 18.2µs | 🟢 2.9× faster |
| `set 1000 atoms` | 96.9µs | 943.1µs | 🟢 9.7× faster |
| `set(atom, curr => curr+1)` | 133ns | 3.4µs | 🟢 25.9× faster |
| `set(atom, value)` | 136ns | 4.2µs | 🟢 31.3× faster |
| `set(atom) with 10 subs` | 144ns | 4.1µs | 🟢 28.5× faster |
| `store.get(atom)` | 40ns | 381ns | 🟢 9.5× faster |
| `sub + unsub` | 418ns | 3.6µs | 🟢 8.7× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 115.9µs | 137.0µs | 🟢 1.2× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 66.5µs | 95.7µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 552.6µs | 660.1µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 67.8µs | 300.8µs | 🟢 4.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 82.5µs | 638.6µs | 🟢 7.7× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 687.2µs | 3.70ms | 🟢 5.4× faster |
| `txn: asymmetric DAG shared sink` | 22.7µs | 148.2µs | 🟢 6.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 819.8µs | 5.23ms | 🟢 6.4× faster |
| `txn: cross-atom 1000 selectors, with subs` | 942.7µs | 24.27ms | 🟢 25.7× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.15ms | 20.71ms | 🟢 5.0× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 26.6µs | 143.4µs | 🟢 5.4× faster |
| `atom(1)` | 27ns | 49ns | 🟢 1.8× faster |
| `atomFamily(id)` | 126ns | 265ns | 🟢 2.1× faster |
| `atomFamily(id) cache hit` | 5ns | 26ns | 🟢 5.4× faster |
| `createStore` | 222ns | 1.6µs | 🟢 7.2× faster |
| `get 1000 atoms` | 15.2µs | 209.6µs | 🟢 13.7× faster |
| `selector(fn)` | 45ns | 57ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 209ns | 195ns | 🔴 1.1× slower |
| `set + read 10 selectors` | 7.3µs | 20.2µs | 🟢 2.8× faster |
| `set + read 100 selectorFamily entries` | 67.5µs | 131.3µs | 🟢 1.9× faster |
| `set + read 100 selectors` | 66.5µs | 130.9µs | 🟢 2.0× faster |
| `set + read through 5 chained selectors` | 4.8µs | 10.1µs | 🟢 2.1× faster |
| `set 1000 atoms` | 89.3µs | 426.3µs | 🟢 4.8× faster |
| `set(atom, curr => curr+1)` | 252ns | 1.5µs | 🟢 5.8× faster |
| `set(atom, value)` | 249ns | 1.2µs | 🟢 4.9× faster |
| `set(atom) with 10 subs` | 285ns | 1.7µs | 🟢 6.1× faster |
| `store.get(atom)` | 19ns | 163ns | 🟢 8.6× faster |
| `sub + unsub` | 728ns | 2.1µs | 🟢 2.9× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 130.7µs | 105.2µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 70.0µs | 55.7µs | 🔴 1.3× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 597.7µs | 515.3µs | 🔴 1.2× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 123.2µs | 178.3µs | 🟢 1.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 79.2µs | 255.8µs | 🟢 3.2× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 766.1µs | 1.39ms | 🟢 1.8× faster |
| `txn: asymmetric DAG shared sink` | 22.4µs | 54.8µs | 🟢 2.4× faster |
| `txn: cross-atom 1000 selectors, set + read` | 976.6µs | 1.95ms | 🟢 2.0× faster |
| `txn: cross-atom 1000 selectors, with subs` | 919.0µs | 12.47ms | 🟢 13.6× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.72ms | 9.10ms | 🟢 2.4× faster |

<!-- BENCH:END -->
