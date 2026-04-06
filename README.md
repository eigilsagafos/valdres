# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 51ns | 🟢 20.7x faster |
| store.get(atom) | 40ns | 390ns | 🟢 9.8x faster |
| set(atom, value) | 251ns | 2.2µs | 🟢 8.7x faster |
| set(atom, curr => curr+1) | 293ns | 2.8µs | 🟢 9.5x faster |
| set(atom) with 10 subs | 550ns | 3.9µs | 🟢 7.1x faster |
| atom lifecycle (create+100get+100set) | 25.1µs | 291.1µs | 🟢 11.6x faster |
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.4x slower |
| selector(fn) | 5ns | 59ns | 🟢 11.4x faster |
| set + read 10 selectors | 6.3µs | 24.0µs | 🟢 3.8x faster |
| set + read 100 selectors | 58.3µs | 258.5µs | 🟢 4.4x faster |
| set + read through 5 chained selectors | 5.2µs | 14.1µs | 🟢 2.7x faster |
| set 1000 atoms | 87.8µs | 1.01ms | 🟢 11.5x faster |
| get 1000 atoms | 7.6µs | 378.1µs | 🟢 49.8x faster |
| txn: 10 atoms × 10 selectors, set + read | 62.5µs | 283.3µs | 🟢 4.5x faster |
| txn: 10 atoms × 10 selectors, with subs | 114.6µs | 584.9µs | 🟢 5.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 597.8µs | 2.56ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, set + read | 749.8µs | 3.31ms | 🟢 4.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.27ms | 21.88ms | 🟢 17.2x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 290ns | 432ns | 1.5x faster |
| selectorFamily(id) | 313ns | 454ns | 1.5x faster |
| createStore | 451ns | 6.0µs | 13.3x faster |
| sub + unsub | 391ns | 2.4µs | 6.2x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 18ns |
| valdres get | 8ns |
| jotai get | 371ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 241ns |
| jotai set | 2.4µs |

> Last updated: 2026-04-06 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
