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
| set(atom, value) | 🟢 12.7x faster | 🟢 4.4x faster |
| set(atom, curr => curr+1) | 🟢 13.5x faster | 🟢 5.1x faster |
| set(atom) with 10 subs | 🟢 19.0x faster | 🟢 5.5x faster |
| atom lifecycle (create+100get+100set) | 🟢 18.4x faster | 🟢 4.3x faster |
| set 1000 atoms | 🟢 16.9x faster | 🟢 4.4x faster |
| get 1000 atoms | 🟢 89.2x faster | 🟢 14.9x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 9.4x faster | 🟢 1.2x faster |
| set + read 10 selectors | 🟢 3.7x faster | 🟢 2.8x faster |
| set + read 100 selectors | 🟢 4.4x faster | 🟢 1.8x faster |
| set + read through 5 chained selectors | 🟢 2.2x faster | 🟢 2.4x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 4.9x faster | 🟢 1.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 6.2x faster | 🟢 3.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 6.4x faster | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 5.6x faster | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 23.4x faster | 🟢 13.5x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 4.8x slower | 🟡 1.5x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.4x faster | 🟢 1.3x faster |
| selectorFamily(id) | 🟢 1.4x faster | 🟢 1.2x faster |
| createStore | 🟢 10.2x faster | 🟢 8.0x faster |
| sub + unsub | 🟢 4.8x faster | 🟢 3.1x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-10 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
