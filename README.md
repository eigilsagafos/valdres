# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 50ns | 🟢 21.3x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 260ns | 2.1µs | 🟢 8.2x faster |
| set(atom, curr => curr+1) | 250ns | 2.7µs | 🟢 10.8x faster |
| set(atom) with 10 subs | 541ns | 3.6µs | 🟢 6.6x faster |
| atom lifecycle (create+100get+100set) | 26.0µs | 282.2µs | 🟢 10.8x faster |
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.4x slower |
| selector(fn) | 7ns | 70ns | 🟢 10.8x faster |
| set + read 10 selectors | 8.8µs | 28.4µs | 🟢 3.2x faster |
| set + read 100 selectors | 84.0µs | 334.2µs | 🟢 4.0x faster |
| set + read through 5 chained selectors | 8.4µs | 18.2µs | 🟢 2.2x faster |
| set 1000 atoms | 95.8µs | 1.20ms | 🟢 12.5x faster |
| get 1000 atoms | 7.2µs | 377.1µs | 🟢 52.3x faster |
| txn: 10 atoms × 10 selectors, set + read | 89.7µs | 422.5µs | 🟢 4.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 150.7µs | 745.1µs | 🟢 4.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 798.5µs | 4.50ms | 🟢 5.6x faster |
| txn: cross-atom 1000 selectors, set + read | 960.7µs | 4.79ms | 🟢 5.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.49ms | 24.34ms | 🟢 16.3x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 318ns | 464ns | 1.5x faster |
| selectorFamily(id) | 316ns | 455ns | 1.4x faster |
| createStore | 470ns | 6.4µs | 13.7x faster |
| sub + unsub | 819ns | 2.5µs | 3.1x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 17ns |
| valdres get | 8ns |
| jotai get | 369ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 459ns |
| jotai set | 3.3µs |

> Last updated: 2026-04-07 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
