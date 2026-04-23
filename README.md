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
| atom(1) | 🟢 13.1x faster | 🟢 2.5x faster |
| store.get(atom) | 🟢 12.2x faster | 🟢 15.2x faster |
| set(atom, value) | 🟢 13.5x faster | 🟢 5.5x faster |
| set(atom, curr => curr+1) | 🟢 13.6x faster | 🟢 5.8x faster |
| set(atom) with 10 subs | 🟢 19.8x faster | 🟢 6.6x faster |
| atom lifecycle (create+100get+100set) | 🟢 16.7x faster | 🟢 5.0x faster |
| set 1000 atoms | 🟢 15.9x faster | 🟢 5.2x faster |
| get 1000 atoms | 🟢 76.3x faster | 🟢 14.2x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 9.8x faster | 🟢 1.4x faster |
| set + read 10 selectors | 🟢 3.5x faster | 🟢 2.5x faster |
| set + read 100 selectors | 🟢 4.1x faster | 🟢 2.0x faster |
| set + read through 5 chained selectors | 🟢 2.4x faster | 🟢 2.3x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 3.9x faster | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.5x faster | 🟢 3.5x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 4.4x faster | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 5.3x faster | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 17.7x faster | 🟢 11.9x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 2.6x slower | 🔴 3.5x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.4x faster | 🟢 1.2x faster |
| selectorFamily(id) | 🟢 1.3x faster | 🟢 1.3x faster |
| createStore | 🟢 12.8x faster | 🟢 6.1x faster |
| sub + unsub | 🟢 5.2x faster | 🟢 3.0x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-23 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
