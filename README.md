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
| `atom lifecycle (create+100get+100set)` | 11.9µs | 265.8µs | 🟢 22.3× faster |
| `atom(1)` | 2ns | 53ns | 🟢 22.4× faster |
| `atomFamily(id)` | 246ns | 448ns | 🟢 1.8× faster |
| `atomFamily(id) cache hit` | 29ns | 11ns | 🔴 2.6× slower |
| `createStore` | 261ns | 5.4µs | 🟢 20.6× faster |
| `get 1000 atoms` | 9.7µs | 633.0µs | 🟢 65.3× faster |
| `selector(fn)` | 4ns | 57ns | 🟢 14.0× faster |
| `selectorFamily(id)` | 197ns | 427ns | 🟢 2.2× faster |
| `set + read 10 selectors` | 13.2µs | 40.7µs | 🟢 3.1× faster |
| `set + read 100 selectorFamily entries` | 66.7µs | 263.2µs | 🟢 3.9× faster |
| `set + read 100 selectors` | 60.0µs | 364.9µs | 🟢 6.1× faster |
| `set + read through 5 chained selectors` | 5.9µs | 19.2µs | 🟢 3.3× faster |
| `set 1000 atoms` | 104.2µs | 956.4µs | 🟢 9.2× faster |
| `set(atom, curr => curr+1)` | 99ns | 4.5µs | 🟢 45.7× faster |
| `set(atom, value)` | 136ns | 2.2µs | 🟢 16.2× faster |
| `set(atom) with 10 subs` | 159ns | 4.8µs | 🟢 30.3× faster |
| `store.get(atom)` | 31ns | 371ns | 🟢 12.0× faster |
| `sub + unsub` | 468ns | 3.3µs | 🟢 7.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 103.9µs | 173.3µs | 🟢 1.7× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 67.5µs | 99.9µs | 🟢 1.5× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 514.2µs | 644.8µs | 🟢 1.3× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 66.0µs | 288.1µs | 🟢 4.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 104.4µs | 579.5µs | 🟢 5.6× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 696.2µs | 2.77ms | 🟢 4.0× faster |
| `txn: asymmetric DAG shared sink` | 26.3µs | 155.8µs | 🟢 5.9× faster |
| `txn: cross-atom 1000 selectors, set + read` | 775.6µs | 5.33ms | 🟢 6.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.19ms | 23.34ms | 🟢 19.6× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.22ms | 20.84ms | 🟢 4.9× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 25.6µs | 140.7µs | 🟢 5.5× faster |
| `atom(1)` | 26ns | 48ns | 🟢 1.9× faster |
| `atomFamily(id)` | 239ns | 362ns | 🟢 1.5× faster |
| `atomFamily(id) cache hit` | 25ns | 27ns | 🟢 1.1× faster |
| `createStore` | 178ns | 2.0µs | 🟢 11.5× faster |
| `get 1000 atoms` | 14.8µs | 211.2µs | 🟢 14.2× faster |
| `selector(fn)` | 42ns | 53ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 220ns | 244ns | 🟢 1.1× faster |
| `set + read 10 selectors` | 7.8µs | 19.3µs | 🟢 2.5× faster |
| `set + read 100 selectorFamily entries` | 72.9µs | 132.5µs | 🟢 1.8× faster |
| `set + read 100 selectors` | 72.5µs | 131.3µs | 🟢 1.8× faster |
| `set + read through 5 chained selectors` | 5.4µs | 10.8µs | 🟢 2.0× faster |
| `set 1000 atoms` | 82.1µs | 457.5µs | 🟢 5.6× faster |
| `set(atom, curr => curr+1)` | 208ns | 1.5µs | 🟢 7.0× faster |
| `set(atom, value)` | 203ns | 1.2µs | 🟢 6.0× faster |
| `set(atom) with 10 subs` | 248ns | 1.7µs | 🟢 6.9× faster |
| `store.get(atom)` | 18ns | 162ns | 🟢 9.0× faster |
| `sub + unsub` | 877ns | 2.1µs | 🟢 2.4× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 168.1µs | 107.7µs | 🔴 1.6× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 90.3µs | 56.3µs | 🔴 1.6× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 776.5µs | 533.5µs | 🔴 1.5× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 72.3µs | 147.0µs | 🟢 2.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 79.2µs | 244.3µs | 🟢 3.1× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 816.1µs | 1.35ms | 🟢 1.7× faster |
| `txn: asymmetric DAG shared sink` | 23.3µs | 55.2µs | 🟢 2.4× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.01ms | 1.80ms | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.06ms | 12.24ms | 🟢 11.6× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.90ms | 9.44ms | 🟢 2.4× faster |

<!-- BENCH:END -->
