# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 51ns | 🟢 21.0x faster |
| store.get(atom) | 40ns | 390ns | 🟢 9.8x faster |
| set(atom, value) | 260ns | 2.1µs | 🟢 8.2x faster |
| set(atom, curr => curr+1) | 254ns | 2.7µs | 🟢 10.7x faster |
| set(atom) with 10 subs | 561ns | 3.6µs | 🟢 6.4x faster |
| atom lifecycle (create+100get+100set) | 25.4µs | 281.8µs | 🟢 11.1x faster |
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.4x slower |
| selector(fn) | 7ns | 69ns | 🟢 10.6x faster |
| set + read 10 selectors | 8.9µs | 28.8µs | 🟢 3.2x faster |
| set + read 100 selectors | 84.3µs | 265.3µs | 🟢 3.1x faster |
| set + read through 5 chained selectors | 8.2µs | 15.7µs | 🟢 1.9x faster |
| set 1000 atoms | 95.6µs | 1.20ms | 🟢 12.6x faster |
| get 1000 atoms | 7.3µs | 379.1µs | 🟢 51.8x faster |
| txn: 10 atoms × 10 selectors, set + read | 94.8µs | 416.4µs | 🟢 4.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 149.8µs | 752.4µs | 🟢 5.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 813.6µs | 4.52ms | 🟢 5.6x faster |
| txn: cross-atom 1000 selectors, set + read | 969.1µs | 4.77ms | 🟢 4.9x faster |
| txn: cross-atom 1000 selectors, with subs | 1.49ms | 24.51ms | 🟢 16.5x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 312ns | 465ns | 1.5x faster |
| selectorFamily(id) | 312ns | 447ns | 1.4x faster |
| createStore | 474ns | 6.4µs | 13.5x faster |
| sub + unsub | 829ns | 2.5µs | 3.0x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 19ns |
| valdres get | 8ns |
| jotai get | 369ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 442ns |
| jotai set | 3.3µs |

> Last updated: 2026-04-07 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
