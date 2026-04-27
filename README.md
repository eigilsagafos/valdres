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
| atom(1) | 🟢 22.8x faster | 🟢 1.8x faster |
| store.get(atom) | 🟢 9.5x faster | 🟢 11.6x faster |
| set(atom, value) | 🟢 11.7x faster | 🟢 4.6x faster |
| set(atom, curr => curr+1) | 🟢 18.4x faster | 🟢 5.7x faster |
| set(atom) with 10 subs | 🟢 19.1x faster | 🟢 5.7x faster |
| atom lifecycle (create+100get+100set) | 🟢 16.4x faster | 🟢 4.6x faster |
| set 1000 atoms | 🟢 16.3x faster | 🟢 5.3x faster |
| get 1000 atoms | 🟢 78.0x faster | 🟢 14.1x faster |

#### Selectors

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| selector(fn) | 🟢 10.0x faster | 🟢 1.2x faster |
| set + read 10 selectors | 🟢 3.3x faster | 🟢 2.6x faster |
| set + read 100 selectors | 🟢 4.4x faster | 🟢 1.8x faster |
| set + read through 5 chained selectors | 🟢 2.4x faster | 🟢 2.2x faster |

#### Transactions

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 🟢 4.0x faster | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 🟢 4.4x faster | 🟢 3.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 🟢 4.6x faster | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 🟢 5.2x faster | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 🟢 18.9x faster | 🟢 14.1x faster |

#### Families

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) cache hit | 🔴 2.8x slower | 🔴 3.3x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | JSC (Safari) | V8 (Chrome) |
|:----------|-----------:|-----------:|
| atomFamily(id) | 🟢 1.3x faster | 🟢 1.1x faster |
| selectorFamily(id) | 🟢 1.4x faster | 🟡 1.0x slower |
| createStore | 🟢 10.3x faster | 🟢 8.7x faster |
| sub + unsub | 🟢 5.0x faster | 🟢 3.2x faster |

> [Full timing details](./BENCHMARKS.md) — Last updated: 2026-04-27 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
