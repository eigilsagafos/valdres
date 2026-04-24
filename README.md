# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0 on the same CI runner using Bun (JavaScriptCore / Safari) and Node.js (V8 / Chrome).

#### Atoms

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atom(1) | 🟢 21.7x faster | 🟢 2.2x faster |
| store.get(atom) | 🟢 9.3x faster | 🟢 13.5x faster |
| set(atom, value) | 🟢 11.3x faster | 🟢 4.5x faster |
| set(atom, curr => curr+1) | 🟢 17.6x faster | 🟢 5.4x faster |
| set(atom) with 10 subs | 🟢 18.4x faster | 🟢 5.7x faster |
| atom lifecycle (create+100get+100set) | 🟢 15.7x faster | 🟢 4.3x faster |
| set 1000 atoms | 🟢 15.5x faster | 🟢 5.5x faster |
| get 1000 atoms | 🟢 71.4x faster | 🟢 15.1x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 14.7x faster | 🟢 1.3x faster |
| set + read 10 selectors | 🟢 3.6x faster | 🟢 2.2x faster |
| set + read 100 selectors | 🟢 4.2x faster | 🟢 1.6x faster |
| set + read through 5 chained selectors | 🟢 2.3x faster | 🟢 1.9x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 3.7x faster | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.6x faster | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 4.3x faster | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 5.2x faster | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 17.5x faster | 🟢 12.3x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 2.6x slower | 🔴 3.8x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.5x faster | 🟢 1.3x faster |
| selectorFamily(id) | 🟢 1.4x faster | 🟢 1.5x faster |
| createStore | 🟢 10.7x faster | 🟢 7.6x faster |
| sub + unsub | 🟢 5.2x faster | 🟢 2.7x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-24 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
