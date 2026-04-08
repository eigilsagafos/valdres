# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 54ns | 🟢 20.0x faster |
| store.get(atom) | 40ns | 401ns | 🟢 10.0x faster |
| set(atom, value) | 240ns | 2.1µs | 🟢 8.9x faster |
| set(atom, curr => curr+1) | 251ns | 2.7µs | 🟢 10.9x faster |
| set(atom) with 10 subs | 576ns | 3.6µs | 🟢 6.2x faster |
| atom lifecycle (create+100get+100set) | 26.0µs | 282.1µs | 🟢 10.9x faster |
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.4x slower |
| selector(fn) | 7ns | 58ns | 🟢 8.7x faster |
| set + read 10 selectors | 9.5µs | 30.8µs | 🟢 3.2x faster |
| set + read 100 selectors | 97.6µs | 358.1µs | 🟢 3.7x faster |
| set + read through 5 chained selectors | 9.2µs | 19.7µs | 🟢 2.1x faster |
| set 1000 atoms | 98.3µs | 1.27ms | 🟢 12.9x faster |
| get 1000 atoms | 7.3µs | 376.0µs | 🟢 51.5x faster |
| txn: 10 atoms × 10 selectors, set + read | 105.6µs | 493.7µs | 🟢 4.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 172.0µs | 804.4µs | 🟢 4.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 873.4µs | 3.94ms | 🟢 4.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.03ms | 5.09ms | 🟢 4.9x faster |
| txn: cross-atom 1000 selectors, with subs | 1.60ms | 26.79ms | 🟢 16.8x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 311ns | 445ns | 1.4x faster |
| selectorFamily(id) | 1.1µs | 689ns | 1.6x slower |
| createStore | 163ns | 6.6µs | 40.6x faster |
| sub + unsub | 371ns | 2.6µs | 7.0x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 19ns |
| valdres get | 8ns |
| jotai get | 369ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 251ns |
| jotai set | 3.4µs |

> Last updated: 2026-04-08 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
