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
| atom(1) | 🟢 23.1x faster | 🟢 1.8x faster |
| store.get(atom) | 🟢 9.7x faster | 🟢 12.7x faster |
| set(atom, value) | 🟢 11.9x faster | 🟢 4.4x faster |
| set(atom, curr => curr+1) | 🟢 16.1x faster | 🟢 5.1x faster |
| set(atom) with 10 subs | 🟢 18.5x faster | 🟢 5.7x faster |
| atom lifecycle (create+100get+100set) | 🟢 17.9x faster | 🟢 4.5x faster |
| set 1000 atoms | 🟢 16.8x faster | 🟢 4.6x faster |
| get 1000 atoms | 🟢 66.7x faster | 🟢 15.6x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 9.0x faster | 🟢 1.2x faster |
| set + read 10 selectors | 🟢 3.6x faster | 🟢 2.4x faster |
| set + read 100 selectors | 🟢 3.6x faster | 🟢 1.8x faster |
| set + read through 5 chained selectors | 🟢 2.0x faster | 🟢 2.2x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 5.2x faster | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.4x faster | 🟢 3.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 4.7x faster | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 4.3x faster | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 14.9x faster | 🟢 13.2x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 4.9x slower | 🔴 3.4x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.4x faster | 🟢 1.1x faster |
| selectorFamily(id) | 🟢 1.2x faster | 🟢 1.1x faster |
| createStore | 🟢 9.5x faster | 🟢 8.9x faster |
| sub + unsub | 🟢 5.0x faster | 🟢 3.0x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-14 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
