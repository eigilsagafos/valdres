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
| atom(1) | 🟢 21.9x faster | 🟢 2.1x faster |
| store.get(atom) | 🟢 9.0x faster | 🟢 13.6x faster |
| set(atom, value) | 🟢 12.6x faster | 🟢 4.3x faster |
| set(atom, curr => curr+1) | 🟢 14.9x faster | 🟢 4.4x faster |
| set(atom) with 10 subs | 🟢 18.3x faster | 🟢 5.6x faster |
| atom lifecycle (create+100get+100set) | 🟢 16.1x faster | 🟢 4.7x faster |
| set 1000 atoms | 🟢 15.6x faster | 🟢 4.9x faster |
| get 1000 atoms | 🟢 89.6x faster | 🟢 14.7x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 12.7x faster | 🟢 1.3x faster |
| set + read 10 selectors | 🟢 3.6x faster | 🟢 2.3x faster |
| set + read 100 selectors | 🟢 4.1x faster | 🟢 1.6x faster |
| set + read through 5 chained selectors | 🟢 2.3x faster | 🟢 2.0x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 4.9x faster | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 5.1x faster | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 5.7x faster | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 5.1x faster | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 17.0x faster | 🟢 13.0x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 2.6x slower | 🔴 4.5x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.6x faster | 🟢 1.3x faster |
| selectorFamily(id) | 🟢 1.5x faster | 🟢 1.3x faster |
| createStore | 🟢 10.5x faster | 🟢 7.6x faster |
| sub + unsub | 🟢 5.0x faster | 🟢 2.7x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-24 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
