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
| atom(1) | 🟢 21.7x faster | 🟢 1.8x faster |
| store.get(atom) | 🟢 9.5x faster | 🟢 12.6x faster |
| set(atom, value) | 🟢 11.9x faster | 🟢 4.6x faster |
| set(atom, curr => curr+1) | 🟢 13.5x faster | 🟢 5.2x faster |
| set(atom) with 10 subs | 🟢 19.9x faster | 🟢 6.0x faster |
| atom lifecycle (create+100get+100set) | 🟢 18.4x faster | 🟢 4.7x faster |
| set 1000 atoms | 🟢 16.6x faster | 🟢 3.7x faster |
| get 1000 atoms | 🟢 76.6x faster | 🟢 14.8x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 10.1x faster | 🟢 1.2x faster |
| set + read 10 selectors | 🟢 3.7x faster | 🟢 2.5x faster |
| set + read 100 selectors | 🟢 4.6x faster | 🟢 1.8x faster |
| set + read through 5 chained selectors | 🟢 2.4x faster | 🟢 2.2x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 4.0x faster | 🟢 1.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.4x faster | 🟢 3.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 4.6x faster | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 5.4x faster | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 17.8x faster | 🟢 13.5x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 4.9x slower | 🔴 3.4x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.4x faster | 🟢 1.2x faster |
| selectorFamily(id) | 🟢 1.4x faster | 🟢 1.5x faster |
| createStore | 🟢 10.1x faster | 🟢 7.6x faster |
| sub + unsub | 🟢 4.7x faster | 🟢 3.1x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-13 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
