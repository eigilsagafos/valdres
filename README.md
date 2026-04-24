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
| atom(1) | 🟢 20.6x faster | 🟢 2.1x faster |
| store.get(atom) | 🟢 10.5x faster | 🟢 13.5x faster |
| set(atom, value) | 🟢 11.9x faster | 🟢 4.5x faster |
| set(atom, curr => curr+1) | 🟢 14.5x faster | 🟢 4.9x faster |
| set(atom) with 10 subs | 🟢 17.9x faster | 🟢 5.5x faster |
| atom lifecycle (create+100get+100set) | 🟢 17.0x faster | 🟢 4.5x faster |
| set 1000 atoms | 🟢 15.4x faster | 🟢 5.0x faster |
| get 1000 atoms | 🟢 88.0x faster | 🟢 15.0x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 11.4x faster | 🟢 1.3x faster |
| set + read 10 selectors | 🟢 3.5x faster | 🟢 2.2x faster |
| set + read 100 selectors | 🟢 4.1x faster | 🟢 1.6x faster |
| set + read through 5 chained selectors | 🟢 2.4x faster | 🟢 2.0x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 4.8x faster | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 5.1x faster | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 5.7x faster | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 5.1x faster | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 17.2x faster | 🟢 12.8x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 2.6x slower | 🔴 3.8x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.5x faster | 🟢 1.2x faster |
| selectorFamily(id) | 🟢 1.4x faster | 🟢 1.3x faster |
| createStore | 🟢 10.5x faster | 🟢 8.2x faster |
| sub + unsub | 🟢 5.0x faster | 🟢 2.6x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-24 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
