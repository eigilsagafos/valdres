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
| atom(1) | 🟢 17.3x faster | 🟢 2.5x faster |
| store.get(atom) | 🟢 13.2x faster | 🟢 14.4x faster |
| set(atom, value) | 🟢 13.7x faster | 🟢 5.3x faster |
| set(atom, curr => curr+1) | 🟢 13.9x faster | 🟢 5.8x faster |
| set(atom) with 10 subs | 🟢 18.8x faster | 🟢 6.6x faster |
| atom lifecycle (create+100get+100set) | 🟢 18.0x faster | 🟢 5.2x faster |
| set 1000 atoms | 🟢 16.0x faster | 🟢 5.2x faster |
| get 1000 atoms | 🟢 129.2x faster | 🟢 13.7x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 9.7x faster | 🟢 1.5x faster |
| set + read 10 selectors | 🟢 3.1x faster | 🟢 2.4x faster |
| set + read 100 selectors | 🟢 4.1x faster | 🟢 1.9x faster |
| set + read through 5 chained selectors | 🟢 2.3x faster | 🟢 2.2x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 3.8x faster | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.3x faster | 🟢 3.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 4.2x faster | 🟢 2.0x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 5.2x faster | 🟢 2.0x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 16.5x faster | 🟢 12.4x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 3.8x slower | 🔴 2.1x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.3x faster | 🟢 1.3x faster |
| selectorFamily(id) | 🟢 1.3x faster | 🟢 1.2x faster |
| createStore | 🟢 13.1x faster | 🟢 6.4x faster |
| sub + unsub | 🟢 5.1x faster | 🟢 2.7x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-10 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
