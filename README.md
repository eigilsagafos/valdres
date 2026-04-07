# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 52ns | 🟢 19.9x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 260ns | 2.1µs | 🟢 8.1x faster |
| set(atom, curr => curr+1) | 258ns | 2.7µs | 🟢 10.6x faster |
| set(atom) with 10 subs | 595ns | 3.6µs | 🟢 6.1x faster |
| atom lifecycle (create+100get+100set) | 34.3µs | 282.1µs | 🟢 8.2x faster |
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.4x slower |
| selector(fn) | 7ns | 70ns | 🟢 10.5x faster |
| set + read 10 selectors | 9.0µs | 28.3µs | 🟢 3.1x faster |
| set + read 100 selectors | 83.4µs | 331.7µs | 🟢 4.0x faster |
| set + read through 5 chained selectors | 8.5µs | 18.1µs | 🟢 2.1x faster |
| set 1000 atoms | 97.1µs | 1.22ms | 🟢 12.6x faster |
| get 1000 atoms | 7.3µs | 375.4µs | 🟢 51.7x faster |
| txn: 10 atoms × 10 selectors, set + read | 90.8µs | 412.2µs | 🟢 4.5x faster |
| txn: 10 atoms × 10 selectors, with subs | 150.2µs | 735.1µs | 🟢 4.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 815.6µs | 4.49ms | 🟢 5.5x faster |
| txn: cross-atom 1000 selectors, set + read | 972.7µs | 4.82ms | 🟢 5.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.47ms | 24.60ms | 🟢 16.7x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 333ns | 461ns | 1.4x faster |
| selectorFamily(id) | 341ns | 455ns | 1.3x faster |
| createStore | 456ns | 6.5µs | 14.2x faster |
| sub + unsub | 842ns | 2.6µs | 3.1x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 19ns |
| valdres get | 8ns |
| jotai get | 368ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 481ns |
| jotai set | 3.3µs |

> Last updated: 2026-04-07 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
