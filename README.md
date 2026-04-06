# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 4ns | 69ns | 🟢 17.3x faster |
| store.get(atom) | 26ns | 384ns | 🟢 14.8x faster |
| set(atom, value) | 255ns | 2.2µs | 🟢 8.5x faster |
| set(atom, curr => curr+1) | 286ns | 2.7µs | 🟢 9.4x faster |
| set(atom) with 10 subs | 568ns | 3.6µs | 🟢 6.3x faster |
| atom lifecycle (create+100get+100set) | 24.5µs | 262.2µs | 🟢 10.7x faster |
| atomFamily(id) cache hit | 44ns | 11ns | 🔴 3.9x slower |
| selector(fn) | 8ns | 67ns | 🟢 8.0x faster |
| set + read 10 selectors | 6.8µs | 24.6µs | 🟢 3.6x faster |
| set + read 100 selectors | 60.1µs | 248.7µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 5.2µs | 13.1µs | 🟢 2.5x faster |
| set 1000 atoms | 89.0µs | 1.02ms | 🟢 11.5x faster |
| get 1000 atoms | 7.4µs | 345.5µs | 🟢 46.8x faster |
| txn: 10 atoms × 10 selectors, set + read | 68.7µs | 251.9µs | 🟢 3.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 110.5µs | 484.7µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 690.6µs | 2.21ms | 🟢 3.2x faster |
| txn: cross-atom 1000 selectors, set + read | 862.0µs | 3.28ms | 🟢 3.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.28ms | 19.76ms | 🟢 15.4x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 268ns | 376ns | 1.4x faster |
| selectorFamily(id) | 283ns | 381ns | 1.3x faster |
| createStore | 376ns | 6.8µs | 18.1x faster |
| sub + unsub | 680ns | 2.5µs | 3.7x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 17ns |
| valdres get | 8ns |
| jotai get | 344ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 400ns |
| jotai set | 2.3µs |

> Last updated: 2026-04-06 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
