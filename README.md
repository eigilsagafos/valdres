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
| atom(1) | 🟢 10.7x faster | 🟢 2.5x faster |
| store.get(atom) | 🟢 14.0x faster | 🟢 14.9x faster |
| set(atom, value) | 🟢 13.7x faster | 🟢 5.5x faster |
| set(atom, curr => curr+1) | 🟢 13.3x faster | 🟢 6.1x faster |
| set(atom) with 10 subs | 🟢 20.7x faster | 🟢 7.2x faster |
| atom lifecycle (create+100get+100set) | 🟢 17.8x faster | 🟢 5.2x faster |
| set 1000 atoms | 🟢 16.9x faster | 🟢 4.9x faster |
| get 1000 atoms | 🟢 79.2x faster | 🟢 14.1x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 8.8x faster | 🟢 1.7x faster |
| set + read 10 selectors | 🟢 3.4x faster | 🟢 2.7x faster |
| set + read 100 selectors | 🟢 4.2x faster | 🟢 2.0x faster |
| set + read through 5 chained selectors | 🟢 2.2x faster | 🟢 2.3x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 3.7x faster | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.7x faster | 🟢 3.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 4.6x faster | 🟢 2.0x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 5.4x faster | 🟢 2.2x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 20.0x faster | 🟢 12.2x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 3.9x slower | 🔴 3.2x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.4x faster | 🟢 1.2x faster |
| selectorFamily(id) | 🟢 1.3x faster | 🟢 1.2x faster |
| createStore | 🟢 11.4x faster | 🟢 5.2x faster |
| sub + unsub | 🟢 5.5x faster | 🟢 3.2x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-09 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
