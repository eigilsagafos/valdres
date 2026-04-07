# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 50ns | 🟢 20.0x faster |
| store.get(atom) | 40ns | 410ns | 🟢 10.3x faster |
| set(atom, value) | 260ns | 2.1µs | 🟢 8.2x faster |
| set(atom, curr => curr+1) | 278ns | 2.7µs | 🟢 9.9x faster |
| set(atom) with 10 subs | 557ns | 3.5µs | 🟢 6.3x faster |
| atom lifecycle (create+100get+100set) | 27.0µs | 287.5µs | 🟢 10.7x faster |
| atomFamily(id) cache hit | 47ns | 11ns | 🔴 4.2x slower |
| selector(fn) | 6ns | 70ns | 🟢 10.9x faster |
| set + read 10 selectors | 8.8µs | 30.9µs | 🟢 3.5x faster |
| set + read 100 selectors | 84.7µs | 333.9µs | 🟢 3.9x faster |
| set + read through 5 chained selectors | 8.5µs | 18.2µs | 🟢 2.2x faster |
| set 1000 atoms | 95.0µs | 1.21ms | 🟢 12.8x faster |
| get 1000 atoms | 7.3µs | 377.5µs | 🟢 51.9x faster |
| txn: 10 atoms × 10 selectors, set + read | 91.2µs | 432.4µs | 🟢 4.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 152.3µs | 748.5µs | 🟢 4.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 824.3µs | 4.53ms | 🟢 5.5x faster |
| txn: cross-atom 1000 selectors, set + read | 983.1µs | 4.81ms | 🟢 4.9x faster |
| txn: cross-atom 1000 selectors, with subs | 1.47ms | 24.87ms | 🟢 16.9x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 321ns | 458ns | 1.4x faster |
| selectorFamily(id) | 327ns | 450ns | 1.4x faster |
| createStore | 478ns | 6.5µs | 13.5x faster |
| sub + unsub | 371ns | 2.6µs | 7.0x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 17ns |
| valdres get | 7ns |
| jotai get | 369ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 463ns |
| jotai set | 3.3µs |

> Last updated: 2026-04-07 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
