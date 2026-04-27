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
| atom(1) | 🟢 22.2x faster | 🟢 1.8x faster |
| store.get(atom) | 🟢 9.7x faster | 🟢 11.6x faster |
| set(atom, value) | 🟢 11.6x faster | 🟢 4.7x faster |
| set(atom, curr => curr+1) | 🟢 18.2x faster | 🟢 6.0x faster |
| set(atom) with 10 subs | 🟢 19.6x faster | 🟢 6.1x faster |
| atom lifecycle (create+100get+100set) | 🟢 15.9x faster | 🟢 4.6x faster |
| set 1000 atoms | 🟢 16.4x faster | 🟢 5.3x faster |
| get 1000 atoms | 🟢 76.3x faster | 🟢 14.2x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 8.7x faster | 🟢 1.2x faster |
| set + read 10 selectors | 🟢 3.6x faster | 🟢 2.4x faster |
| set + read 100 selectors | 🟢 4.4x faster | 🟢 1.9x faster |
| set + read through 5 chained selectors | 🟢 2.3x faster | 🟢 2.2x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 3.9x faster | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.4x faster | 🟢 3.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 4.6x faster | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 5.3x faster | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 18.0x faster | 🟢 13.2x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 2.7x slower | 🔴 3.3x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.5x faster | 🟢 1.2x faster |
| selectorFamily(id) | 🟢 1.3x faster | 🟢 1.2x faster |
| createStore | 🟢 9.6x faster | 🟢 8.0x faster |
| sub + unsub | 🟢 5.2x faster | 🟢 3.1x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-27 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
