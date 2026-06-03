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
| `atom lifecycle (create+100get+100set)` | 11.9µs | 273.0µs | 🟢 22.9× faster |
| `atom(1)` | 2ns | 56ns | 🟢 23.9× faster |
| `atomFamily(id)` | 258ns | 450ns | 🟢 1.7× faster |
| `atomFamily(id) cache hit` | 31ns | 12ns | 🔴 2.7× slower |
| `createStore` | 260ns | 5.0µs | 🟢 19.4× faster |
| `get 1000 atoms` | 10.5µs | 631.2µs | 🟢 59.9× faster |
| `selector(fn)` | 4ns | 58ns | 🟢 13.1× faster |
| `selectorFamily(id)` | 181ns | 438ns | 🟢 2.4× faster |
| `set + read 10 selectors` | 7.9µs | 39.5µs | 🟢 5.0× faster |
| `set + read 100 selectorFamily entries` | 62.9µs | 258.0µs | 🟢 4.1× faster |
| `set + read 100 selectors` | 63.4µs | 338.9µs | 🟢 5.3× faster |
| `set + read through 5 chained selectors` | 5.3µs | 17.5µs | 🟢 3.3× faster |
| `set 1000 atoms` | 99.5µs | 923.8µs | 🟢 9.3× faster |
| `set(atom, curr => curr+1)` | 95ns | 3.4µs | 🟢 35.6× faster |
| `set(atom, value)` | 130ns | 2.3µs | 🟢 17.5× faster |
| `set(atom) with 10 subs` | 136ns | 4.5µs | 🟢 32.8× faster |
| `store.get(atom)` | 40ns | 381ns | 🟢 9.5× faster |
| `sub + unsub` | 338ns | 3.1µs | 🟢 9.2× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 121.5µs | 172.4µs | 🟢 1.4× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 72.5µs | 104.8µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 551.1µs | 650.4µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 63.1µs | 279.3µs | 🟢 4.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 75.2µs | 546.8µs | 🟢 7.3× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 664.6µs | 3.41ms | 🟢 5.1× faster |
| `txn: asymmetric DAG shared sink` | 21.7µs | 112.2µs | 🟢 5.2× faster |
| `txn: cross-atom 1000 selectors, set + read` | 822.7µs | 4.26ms | 🟢 5.2× faster |
| `txn: cross-atom 1000 selectors, with subs` | 928.3µs | 20.07ms | 🟢 21.6× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.95ms | 15.65ms | 🟢 4.0× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 23.9µs | 139.5µs | 🟢 5.8× faster |
| `atom(1)` | 27ns | 48ns | 🟢 1.8× faster |
| `atomFamily(id)` | 321ns | 362ns | 🟢 1.1× faster |
| `atomFamily(id) cache hit` | 23ns | 27ns | 🟢 1.2× faster |
| `createStore` | 175ns | 1.9µs | 🟢 10.6× faster |
| `get 1000 atoms` | 15.2µs | 209.3µs | 🟢 13.8× faster |
| `selector(fn)` | 43ns | 53ns | 🟢 1.2× faster |
| `selectorFamily(id)` | 218ns | 259ns | 🟢 1.2× faster |
| `set + read 10 selectors` | 7.3µs | 21.7µs | 🟢 2.9× faster |
| `set + read 100 selectorFamily entries` | 66.0µs | 128.0µs | 🟢 1.9× faster |
| `set + read 100 selectors` | 65.0µs | 129.3µs | 🟢 2.0× faster |
| `set + read through 5 chained selectors` | 4.7µs | 9.4µs | 🟢 2.0× faster |
| `set 1000 atoms` | 82.0µs | 423.4µs | 🟢 5.2× faster |
| `set(atom, curr => curr+1)` | 201ns | 1.4µs | 🟢 7.2× faster |
| `set(atom, value)` | 198ns | 1.2µs | 🟢 6.1× faster |
| `set(atom) with 10 subs` | 235ns | 1.7µs | 🟢 7.4× faster |
| `store.get(atom)` | 15ns | 162ns | 🟢 11.0× faster |
| `sub + unsub` | 728ns | 2.1µs | 🟢 2.8× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 165.4µs | 108.3µs | 🔴 1.5× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 87.1µs | 56.0µs | 🔴 1.6× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 753.7µs | 518.5µs | 🔴 1.5× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 63.1µs | 149.7µs | 🟢 2.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 72.9µs | 290.9µs | 🟢 4.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 768.2µs | 1.33ms | 🟢 1.7× faster |
| `txn: asymmetric DAG shared sink` | 20.1µs | 54.3µs | 🟢 2.7× faster |
| `txn: cross-atom 1000 selectors, set + read` | 931.2µs | 1.81ms | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, with subs` | 877.1µs | 13.29ms | 🟢 15.1× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.51ms | 9.01ms | 🟢 2.6× faster |

<!-- BENCH:END -->
