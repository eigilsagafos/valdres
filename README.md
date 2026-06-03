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
| `atom lifecycle (create+100get+100set)` | 12.7µs | 273.6µs | 🟢 21.6× faster |
| `atom(1)` | 2ns | 59ns | 🟢 24.6× faster |
| `atomFamily(id)` | 320ns | 509ns | 🟢 1.6× faster |
| `atomFamily(id) cache hit` | 32ns | 11ns | 🔴 2.8× slower |
| `createStore` | 273ns | 5.3µs | 🟢 19.3× faster |
| `get 1000 atoms` | 10.2µs | 640.0µs | 🟢 62.7× faster |
| `selector(fn)` | 6ns | 62ns | 🟢 11.1× faster |
| `selectorFamily(id)` | 244ns | 479ns | 🟢 2.0× faster |
| `set + read 10 selectors` | 7.6µs | 37.0µs | 🟢 4.9× faster |
| `set + read 100 selectorFamily entries` | 65.4µs | 269.6µs | 🟢 4.1× faster |
| `set + read 100 selectors` | 64.4µs | 405.2µs | 🟢 6.3× faster |
| `set + read through 5 chained selectors` | 5.3µs | 18.0µs | 🟢 3.4× faster |
| `set 1000 atoms` | 97.8µs | 934.1µs | 🟢 9.6× faster |
| `set(atom, curr => curr+1)` | 95ns | 3.3µs | 🟢 34.6× faster |
| `set(atom, value)` | 141ns | 4.3µs | 🟢 30.6× faster |
| `set(atom) with 10 subs` | 137ns | 4.6µs | 🟢 33.2× faster |
| `store.get(atom)` | 40ns | 481ns | 🟢 12.0× faster |
| `sub + unsub` | 357ns | 3.2µs | 🟢 9.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 122.2µs | 143.0µs | 🟢 1.2× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 104.2µs | 100.1µs | 🔴 1.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 603.4µs | 751.9µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 64.1µs | 375.3µs | 🟢 5.9× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 75.9µs | 507.1µs | 🟢 6.7× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 659.4µs | 3.64ms | 🟢 5.5× faster |
| `txn: asymmetric DAG shared sink` | 22.8µs | 138.2µs | 🟢 6.1× faster |
| `txn: cross-atom 1000 selectors, set + read` | 870.6µs | 4.00ms | 🟢 4.6× faster |
| `txn: cross-atom 1000 selectors, with subs` | 975.7µs | 21.94ms | 🟢 22.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.15ms | 15.39ms | 🟢 3.7× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 24.3µs | 140.1µs | 🟢 5.8× faster |
| `atom(1)` | 27ns | 48ns | 🟢 1.8× faster |
| `atomFamily(id)` | 274ns | 438ns | 🟢 1.6× faster |
| `atomFamily(id) cache hit` | 24ns | 28ns | 🟢 1.2× faster |
| `createStore` | 176ns | 1.9µs | 🟢 10.7× faster |
| `get 1000 atoms` | 15.3µs | 208.8µs | 🟢 13.7× faster |
| `selector(fn)` | 44ns | 54ns | 🟢 1.2× faster |
| `selectorFamily(id)` | 255ns | 276ns | 🟢 1.1× faster |
| `set + read 10 selectors` | 7.8µs | 22.8µs | 🟢 2.9× faster |
| `set + read 100 selectorFamily entries` | 68.2µs | 130.4µs | 🟢 1.9× faster |
| `set + read 100 selectors` | 67.5µs | 130.8µs | 🟢 1.9× faster |
| `set + read through 5 chained selectors` | 4.9µs | 9.8µs | 🟢 2.0× faster |
| `set 1000 atoms` | 81.8µs | 424.0µs | 🟢 5.2× faster |
| `set(atom, curr => curr+1)` | 199ns | 1.5µs | 🟢 7.4× faster |
| `set(atom, value)` | 208ns | 1.2µs | 🟢 5.7× faster |
| `set(atom) with 10 subs` | 232ns | 1.7µs | 🟢 7.5× faster |
| `store.get(atom)` | 15ns | 162ns | 🟢 11.0× faster |
| `sub + unsub` | 703ns | 2.2µs | 🟢 3.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 128.8µs | 106.0µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 68.7µs | 55.3µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 591.6µs | 520.7µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 67.3µs | 150.9µs | 🟢 2.2× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 70.7µs | 245.6µs | 🟢 3.5× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 738.0µs | 1.37ms | 🟢 1.9× faster |
| `txn: asymmetric DAG shared sink` | 20.4µs | 54.7µs | 🟢 2.7× faster |
| `txn: cross-atom 1000 selectors, set + read` | 943.3µs | 1.84ms | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 909.7µs | 14.13ms | 🟢 15.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.66ms | 9.97ms | 🟢 2.7× faster |

<!-- BENCH:END -->
