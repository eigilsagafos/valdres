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
| atom(1) | 🟢 22.0x faster | 🟢 1.8x faster |
| store.get(atom) | 🟢 9.5x faster | 🟢 12.6x faster |
| set(atom, value) | 🟢 11.5x faster | 🟢 4.6x faster |
| set(atom, curr => curr+1) | 🟢 15.1x faster | 🟢 5.3x faster |
| set(atom) with 10 subs | 🟢 18.2x faster | 🟢 5.8x faster |
| atom lifecycle (create+100get+100set) | 🟢 17.9x faster | 🟢 4.5x faster |
| set 1000 atoms | 🟢 16.0x faster | 🟢 4.4x faster |
| get 1000 atoms | 🟢 89.3x faster | 🟢 14.9x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 10.8x faster | 🟢 1.2x faster |
| set + read 10 selectors | 🟢 3.6x faster | 🟢 2.5x faster |
| set + read 100 selectors | 🟢 4.5x faster | 🟢 1.9x faster |
| set + read through 5 chained selectors | 🟢 2.4x faster | 🟢 2.2x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 5.2x faster | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.8x faster | 🟢 3.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 6.2x faster | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 5.4x faster | 🟢 2.0x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 17.7x faster | 🟢 13.6x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 2.7x slower | 🔴 3.3x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.5x faster | 🟢 1.2x faster |
| selectorFamily(id) | 🟢 1.4x faster | 🟢 1.1x faster |
| createStore | 🟢 10.1x faster | 🟢 7.7x faster |
| sub + unsub | 🟢 4.9x faster | 🟢 3.0x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-22 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
