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
| atom(1) | 🟢 14.9x faster | 🟢 2.5x faster |
| store.get(atom) | 🟢 11.4x faster | 🟢 14.5x faster |
| set(atom, value) | 🟢 12.7x faster | 🟢 5.4x faster |
| set(atom, curr => curr+1) | 🟢 13.6x faster | 🟢 5.6x faster |
| set(atom) with 10 subs | 🟢 19.6x faster | 🟢 6.4x faster |
| atom lifecycle (create+100get+100set) | 🟢 18.1x faster | 🟢 5.0x faster |
| set 1000 atoms | 🟢 15.8x faster | 🟢 5.1x faster |
| get 1000 atoms | 🟢 67.7x faster | 🟢 14.3x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 9.3x faster | 🟢 1.6x faster |
| set + read 10 selectors | 🟢 3.7x faster | 🟢 2.6x faster |
| set + read 100 selectors | 🟢 4.4x faster | 🟢 2.1x faster |
| set + read through 5 chained selectors | 🟢 2.4x faster | 🟢 2.5x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 3.8x faster | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.4x faster | 🟢 3.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 4.4x faster | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 5.1x faster | 🟢 2.1x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 17.4x faster | 🟢 13.3x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 4.0x slower | 🔴 3.6x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.4x faster | 🟢 1.2x faster |
| selectorFamily(id) | 🟢 1.3x faster | 🟢 1.3x faster |
| createStore | 🟢 13.0x faster | 🟢 6.8x faster |
| sub + unsub | 🟢 5.2x faster | 🟢 2.8x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-24 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
