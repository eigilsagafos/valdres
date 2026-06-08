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
| `atom lifecycle (create+100get+100set)` | 11.6µs | 270.5µs | 🟢 23.4× faster |
| `atom(1)` | 6ns | 72ns | 🟢 11.4× faster |
| `atomFamily(id)` | 215ns | 410ns | 🟢 1.9× faster |
| `atomFamily(id) cache hit` | 9ns | 11ns | 🟢 1.2× faster |
| `createStore` | 330ns | 6.4µs | 🟢 19.5× faster |
| `get 1000 atoms` | 9.9µs | 412.8µs | 🟢 41.7× faster |
| `selector(fn)` | 9ns | 75ns | 🟢 8.4× faster |
| `selectorFamily(id)` | 270ns | 362ns | 🟢 1.3× faster |
| `set + read 10 selectors` | 7.8µs | 35.2µs | 🟢 4.5× faster |
| `set + read 100 selectorFamily entries` | 67.2µs | 264.2µs | 🟢 3.9× faster |
| `set + read 100 selectors` | 67.4µs | 329.7µs | 🟢 4.9× faster |
| `set + read through 5 chained selectors` | 5.9µs | 17.3µs | 🟢 2.9× faster |
| `set 1000 atoms` | 100.0µs | 974.9µs | 🟢 9.8× faster |
| `set(atom, curr => curr+1)` | 109ns | 3.8µs | 🟢 35.2× faster |
| `set(atom, value)` | 136ns | 4.2µs | 🟢 30.8× faster |
| `set(atom) with 10 subs` | 143ns | 4.5µs | 🟢 31.3× faster |
| `store.get(atom)` | 26ns | 352ns | 🟢 13.5× faster |
| `sub + unsub` | 536ns | 3.2µs | 🟢 6.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 128.7µs | 154.0µs | 🟢 1.2× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 74.7µs | 101.6µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 599.0µs | 737.9µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 73.3µs | 278.0µs | 🟢 3.8× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 91.1µs | 569.8µs | 🟢 6.3× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 706.0µs | 4.22ms | 🟢 6.0× faster |
| `txn: asymmetric DAG shared sink` | 26.9µs | 147.1µs | 🟢 5.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 913.6µs | 5.92ms | 🟢 6.5× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.09ms | 24.61ms | 🟢 22.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 5.13ms | 24.87ms | 🟢 4.8× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 26.7µs | 152.2µs | 🟢 5.7× faster |
| `atom(1)` | 23ns | 58ns | 🟢 2.5× faster |
| `atomFamily(id)` | 195ns | 301ns | 🟢 1.5× faster |
| `atomFamily(id) cache hit` | 4ns | 24ns | 🟢 5.5× faster |
| `createStore` | 390ns | 2.1µs | 🟢 5.4× faster |
| `get 1000 atoms` | 13.7µs | 184.5µs | 🟢 13.5× faster |
| `selector(fn)` | 45ns | 66ns | 🟢 1.5× faster |
| `selectorFamily(id)` | 215ns | 294ns | 🟢 1.4× faster |
| `set + read 10 selectors` | 6.9µs | 21.9µs | 🟢 3.2× faster |
| `set + read 100 selectorFamily entries` | 70.5µs | 147.3µs | 🟢 2.1× faster |
| `set + read 100 selectors` | 69.4µs | 148.0µs | 🟢 2.1× faster |
| `set + read through 5 chained selectors` | 4.4µs | 11.0µs | 🟢 2.5× faster |
| `set 1000 atoms` | 93.6µs | 468.9µs | 🟢 5.0× faster |
| `set(atom, curr => curr+1)` | 245ns | 1.7µs | 🟢 6.7× faster |
| `set(atom, value)` | 237ns | 1.4µs | 🟢 6.1× faster |
| `set(atom) with 10 subs` | 287ns | 2.0µs | 🟢 6.9× faster |
| `store.get(atom)` | 16ns | 157ns | 🟢 10.0× faster |
| `sub + unsub` | 789ns | 2.3µs | 🟢 3.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 132.9µs | 131.6µs | 🔴 1.0× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 71.5µs | 69.1µs | 🔴 1.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 629.1µs | 651.0µs | 🟢 1.0× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 82.2µs | 194.9µs | 🟢 2.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 74.6µs | 287.0µs | 🟢 3.8× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 799.6µs | 1.53ms | 🟢 1.9× faster |
| `txn: asymmetric DAG shared sink` | 23.4µs | 62.4µs | 🟢 2.7× faster |
| `txn: cross-atom 1000 selectors, set + read` | 995.8µs | 2.12ms | 🟢 2.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 969.5µs | 12.84ms | 🟢 13.2× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.90ms | 10.62ms | 🟢 2.7× faster |

<!-- BENCH:END -->
