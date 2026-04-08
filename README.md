# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 55ns | 🟢 21.6x faster |
| store.get(atom) | 40ns | 380ns | 🟢 9.5x faster |
| set(atom, value) | 241ns | 2.2µs | 🟢 9.1x faster |
| set(atom, curr => curr+1) | 248ns | 2.8µs | 🟢 11.3x faster |
| set(atom) with 10 subs | 577ns | 3.8µs | 🟢 6.6x faster |
| atom lifecycle (create+100get+100set) | 25.6µs | 291.6µs | 🟢 11.4x faster |
| atomFamily(id) cache hit | 54ns | 11ns | 🔴 4.8x slower |
| selector(fn) | 9ns | 64ns | 🟢 7.4x faster |
| set + read 10 selectors | 8.9µs | 30.1µs | 🟢 3.4x faster |
| set + read 100 selectors | 84.0µs | 343.4µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 8.5µs | 18.1µs | 🟢 2.1x faster |
| set 1000 atoms | 94.4µs | 1.20ms | 🟢 12.7x faster |
| get 1000 atoms | 7.7µs | 371.2µs | 🟢 48.0x faster |
| txn: 10 atoms × 10 selectors, set + read | 93.3µs | 407.0µs | 🟢 4.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 147.9µs | 716.6µs | 🟢 4.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 824.5µs | 4.53ms | 🟢 5.5x faster |
| txn: cross-atom 1000 selectors, set + read | 970.8µs | 5.05ms | 🟢 5.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.47ms | 25.66ms | 🟢 17.4x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 370ns | 513ns | 1.4x faster |
| selectorFamily(id) | 369ns | 508ns | 1.4x faster |
| createStore | 501ns | 6.7µs | 13.5x faster |
| sub + unsub | 870ns | 2.5µs | 2.9x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 358ns |
| obj.value = n | 5ns |
| map.set(key, n) | 18ns |
| valdres set | 510ns |
| jotai set | 3.4µs |

> Last updated: 2026-04-08 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
