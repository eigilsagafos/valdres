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
| `atom lifecycle (create+100get+100set)` | 11.7µs | 294.2µs | 🟢 25.1× faster |
| `atom(1)` | 4ns | 62ns | 🟢 15.3× faster |
| `atomFamily(id)` | 181ns | 400ns | 🟢 2.2× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 264ns | 5.4µs | 🟢 20.6× faster |
| `get 1000 atoms` | 10.4µs | 627.9µs | 🟢 60.4× faster |
| `selector(fn)` | 4ns | 58ns | 🟢 13.5× faster |
| `selectorFamily(id)` | 161ns | 252ns | 🟢 1.6× faster |
| `set + read 10 selectors` | 7.9µs | 37.6µs | 🟢 4.7× faster |
| `set + read 100 selectorFamily entries` | 68.6µs | 282.4µs | 🟢 4.1× faster |
| `set + read 100 selectors` | 66.1µs | 362.8µs | 🟢 5.5× faster |
| `set + read through 5 chained selectors` | 6.3µs | 18.9µs | 🟢 3.0× faster |
| `set 1000 atoms` | 101.1µs | 979.9µs | 🟢 9.7× faster |
| `set(atom, curr => curr+1)` | 100ns | 3.6µs | 🟢 36.1× faster |
| `set(atom, value)` | 133ns | 5.7µs | 🟢 42.9× faster |
| `set(atom) with 10 subs` | 141ns | 4.8µs | 🟢 33.9× faster |
| `store.get(atom)` | 40ns | 371ns | 🟢 9.3× faster |
| `sub + unsub` | 650ns | 3.9µs | 🟢 6.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 124.7µs | 140.5µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 71.4µs | 100.3µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 571.3µs | 661.9µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 75.6µs | 342.2µs | 🟢 4.5× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 90.2µs | 654.8µs | 🟢 7.3× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 741.9µs | 4.18ms | 🟢 5.6× faster |
| `txn: asymmetric DAG shared sink` | 29.5µs | 161.9µs | 🟢 5.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 901.4µs | 5.54ms | 🟢 6.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.17ms | 24.55ms | 🟢 21.0× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.93ms | 22.62ms | 🟢 4.6× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 26.6µs | 144.0µs | 🟢 5.4× faster |
| `atom(1)` | 25ns | 52ns | 🟢 2.1× faster |
| `atomFamily(id)` | 129ns | 209ns | 🟢 1.6× faster |
| `atomFamily(id) cache hit` | 4ns | 26ns | 🟢 5.9× faster |
| `createStore` | 297ns | 2.0µs | 🟢 6.7× faster |
| `get 1000 atoms` | 14.6µs | 211.3µs | 🟢 14.5× faster |
| `selector(fn)` | 47ns | 58ns | 🟢 1.2× faster |
| `selectorFamily(id)` | 152ns | 189ns | 🟢 1.2× faster |
| `set + read 10 selectors` | 7.4µs | 20.0µs | 🟢 2.7× faster |
| `set + read 100 selectorFamily entries` | 74.0µs | 133.6µs | 🟢 1.8× faster |
| `set + read 100 selectors` | 70.2µs | 135.3µs | 🟢 1.9× faster |
| `set + read through 5 chained selectors` | 4.8µs | 10.2µs | 🟢 2.1× faster |
| `set 1000 atoms` | 84.1µs | 461.9µs | 🟢 5.5× faster |
| `set(atom, curr => curr+1)` | 231ns | 1.5µs | 🟢 6.6× faster |
| `set(atom, value)` | 229ns | 1.3µs | 🟢 5.7× faster |
| `set(atom) with 10 subs` | 260ns | 1.8µs | 🟢 6.8× faster |
| `store.get(atom)` | 14ns | 163ns | 🟢 12.0× faster |
| `sub + unsub` | 949ns | 2.4µs | 🟢 2.5× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 130.8µs | 108.4µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 69.9µs | 57.3µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 595.5µs | 540.5µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 132.9µs | 174.4µs | 🟢 1.3× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 90.4µs | 259.5µs | 🟢 2.9× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 852.5µs | 1.44ms | 🟢 1.7× faster |
| `txn: asymmetric DAG shared sink` | 25.2µs | 56.4µs | 🟢 2.2× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.07ms | 1.93ms | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.01ms | 12.41ms | 🟢 12.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.91ms | 9.79ms | 🟢 2.5× faster |

<!-- BENCH:END -->
