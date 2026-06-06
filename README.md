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
| `atom lifecycle (create+100get+100set)` | 11.9µs | 267.8µs | 🟢 22.5× faster |
| `atom(1)` | 2ns | 57ns | 🟢 24.3× faster |
| `atomFamily(id)` | 204ns | 437ns | 🟢 2.1× faster |
| `atomFamily(id) cache hit` | 10ns | 12ns | 🟢 1.1× faster |
| `createStore` | 322ns | 5.3µs | 🟢 16.4× faster |
| `get 1000 atoms` | 10.6µs | 432.0µs | 🟢 40.7× faster |
| `selector(fn)` | 5ns | 62ns | 🟢 13.0× faster |
| `selectorFamily(id)` | 149ns | 226ns | 🟢 1.5× faster |
| `set + read 10 selectors` | 7.4µs | 36.8µs | 🟢 5.0× faster |
| `set + read 100 selectorFamily entries` | 61.4µs | 270.1µs | 🟢 4.4× faster |
| `set + read 100 selectors` | 59.3µs | 366.4µs | 🟢 6.2× faster |
| `set + read through 5 chained selectors` | 9.1µs | 21.1µs | 🟢 2.3× faster |
| `set 1000 atoms` | 97.3µs | 932.6µs | 🟢 9.6× faster |
| `set(atom, curr => curr+1)` | 101ns | 3.1µs | 🟢 30.5× faster |
| `set(atom, value)` | 135ns | 4.9µs | 🟢 36.4× faster |
| `set(atom) with 10 subs` | 144ns | 3.9µs | 🟢 26.8× faster |
| `store.get(atom)` | 40ns | 391ns | 🟢 9.8× faster |
| `sub + unsub` | 427ns | 3.5µs | 🟢 8.2× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 163.6µs | 153.1µs | 🔴 1.1× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 81.9µs | 163.7µs | 🟢 2.0× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 608.3µs | 1.04ms | 🟢 1.7× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 67.8µs | 290.0µs | 🟢 4.3× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 80.2µs | 624.8µs | 🟢 7.8× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 672.2µs | 3.72ms | 🟢 5.5× faster |
| `txn: asymmetric DAG shared sink` | 25.6µs | 147.3µs | 🟢 5.7× faster |
| `txn: cross-atom 1000 selectors, set + read` | 880.4µs | 5.24ms | 🟢 5.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 920.3µs | 24.57ms | 🟢 26.7× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.48ms | 20.79ms | 🟢 4.6× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 26.3µs | 140.5µs | 🟢 5.3× faster |
| `atom(1)` | 27ns | 51ns | 🟢 1.9× faster |
| `atomFamily(id)` | 125ns | 252ns | 🟢 2.0× faster |
| `atomFamily(id) cache hit` | 5ns | 27ns | 🟢 5.5× faster |
| `createStore` | 181ns | 1.9µs | 🟢 10.6× faster |
| `get 1000 atoms` | 15.2µs | 206.3µs | 🟢 13.6× faster |
| `selector(fn)` | 67ns | 59ns | 🔴 1.1× slower |
| `selectorFamily(id)` | 183ns | 196ns | 🟢 1.1× faster |
| `set + read 10 selectors` | 7.6µs | 20.5µs | 🟢 2.7× faster |
| `set + read 100 selectorFamily entries` | 67.3µs | 134.3µs | 🟢 2.0× faster |
| `set + read 100 selectors` | 66.6µs | 132.2µs | 🟢 2.0× faster |
| `set + read through 5 chained selectors` | 4.8µs | 10.2µs | 🟢 2.1× faster |
| `set 1000 atoms` | 89.8µs | 444.6µs | 🟢 5.0× faster |
| `set(atom, curr => curr+1)` | 246ns | 1.4µs | 🟢 5.8× faster |
| `set(atom, value)` | 245ns | 1.2µs | 🟢 5.0× faster |
| `set(atom) with 10 subs` | 287ns | 1.7µs | 🟢 6.1× faster |
| `store.get(atom)` | 19ns | 163ns | 🟢 8.6× faster |
| `sub + unsub` | 729ns | 2.2µs | 🟢 3.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 130.6µs | 109.2µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 69.2µs | 57.8µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 590.1µs | 539.7µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 117.3µs | 176.5µs | 🟢 1.5× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 77.6µs | 255.8µs | 🟢 3.3× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 751.4µs | 1.39ms | 🟢 1.9× faster |
| `txn: asymmetric DAG shared sink` | 22.3µs | 55.0µs | 🟢 2.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 991.1µs | 2.07ms | 🟢 2.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 905.6µs | 12.57ms | 🟢 13.9× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.54ms | 9.11ms | 🟢 2.6× faster |

<!-- BENCH:END -->
