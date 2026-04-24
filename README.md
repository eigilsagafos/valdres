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
| atom(1) | 🟢 12.1x faster | 🟢 1.9x faster |
| store.get(atom) | 🟢 9.3x faster | 🟢 13.6x faster |
| set(atom, value) | 🟢 12.2x faster | 🟢 4.3x faster |
| set(atom, curr => curr+1) | 🟢 14.7x faster | 🟢 5.0x faster |
| set(atom) with 10 subs | 🟢 19.4x faster | 🟢 5.5x faster |
| atom lifecycle (create+100get+100set) | 🟢 17.6x faster | 🟢 4.4x faster |
| set 1000 atoms | 🟢 15.3x faster | 🟢 5.0x faster |
| get 1000 atoms | 🟢 77.9x faster | 🟢 15.5x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 11.9x faster | 🟢 1.2x faster |
| set + read 10 selectors | 🟢 3.4x faster | 🟢 2.2x faster |
| set + read 100 selectors | 🟢 4.1x faster | 🟢 1.6x faster |
| set + read through 5 chained selectors | 🟢 2.4x faster | 🟢 1.9x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 3.8x faster | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.4x faster | 🟢 3.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 4.4x faster | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 5.5x faster | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 16.9x faster | 🟢 12.4x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 2.7x slower | 🔴 3.8x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.4x faster | 🟢 1.2x faster |
| selectorFamily(id) | 🟢 1.4x faster | 🟢 1.0x faster |
| createStore | 🟢 11.3x faster | 🟢 9.6x faster |
| sub + unsub | 🟢 5.3x faster | 🟢 2.6x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-24 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
