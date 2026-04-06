# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 49ns | 🟢 21.1x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 251ns | 2.1µs | 🟢 8.5x faster |
| set(atom, curr => curr+1) | 275ns | 3.0µs | 🟢 10.9x faster |
| set(atom) with 10 subs | 559ns | 3.7µs | 🟢 6.6x faster |
| atom lifecycle (create+100get+100set) | 24.1µs | 284.0µs | 🟢 11.8x faster |
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.4x slower |
| selector(fn) | 5ns | 58ns | 🟢 10.8x faster |
| set + read 10 selectors | 6.8µs | 25.7µs | 🟢 3.8x faster |
| set + read 100 selectors | 57.3µs | 258.6µs | 🟢 4.5x faster |
| set + read through 5 chained selectors | 4.9µs | 15.0µs | 🟢 3.0x faster |
| set 1000 atoms | 81.7µs | 1.01ms | 🟢 12.3x faster |
| get 1000 atoms | 7.5µs | 378.0µs | 🟢 50.2x faster |
| txn: 10 atoms × 10 selectors, set + read | 58.3µs | 285.4µs | 🟢 4.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 102.8µs | 573.3µs | 🟢 5.6x faster |
| txn: 10 atoms × 100 selectors, set + read | 549.4µs | 2.57ms | 🟢 4.7x faster |
| txn: cross-atom 1000 selectors, set + read | 663.4µs | 3.29ms | 🟢 5.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.15ms | 18.43ms | 🟢 16.0x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 234ns | 407ns | 1.7x faster |
| selectorFamily(id) | 264ns | 413ns | 1.6x faster |
| createStore | 446ns | 6.1µs | 13.6x faster |
| sub + unsub | 350ns | 2.5µs | 7.0x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 18ns |
| valdres get | 8ns |
| jotai get | 369ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 437ns |
| jotai set | 2.4µs |

> Last updated: 2026-04-06 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
