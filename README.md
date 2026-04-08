# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 5ns | 65ns | 🟢 13.6x faster |
| store.get(atom) | 26ns | 353ns | 🟢 13.6x faster |
| set(atom, value) | 238ns | 2.1µs | 🟢 9.0x faster |
| set(atom, curr => curr+1) | 279ns | 2.7µs | 🟢 9.7x faster |
| set(atom) with 10 subs | 599ns | 3.8µs | 🟢 6.4x faster |
| atom lifecycle (create+100get+100set) | 28.3µs | 286.0µs | 🟢 10.1x faster |
| atomFamily(id) cache hit | 43ns | 11ns | 🔴 3.9x slower |
| selector(fn) | 10ns | 80ns | 🟢 7.9x faster |
| set + read 10 selectors | 8.7µs | 29.8µs | 🟢 3.4x faster |
| set + read 100 selectors | 82.2µs | 310.2µs | 🟢 3.8x faster |
| set + read through 5 chained selectors | 8.1µs | 17.1µs | 🟢 2.1x faster |
| set 1000 atoms | 93.4µs | 1.17ms | 🟢 12.6x faster |
| get 1000 atoms | 7.3µs | 426.0µs | 🟢 58.0x faster |
| txn: 10 atoms × 10 selectors, set + read | 92.5µs | 295.5µs | 🟢 3.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 140.6µs | 593.4µs | 🟢 4.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 804.6µs | 3.20ms | 🟢 4.0x faster |
| txn: cross-atom 1000 selectors, set + read | 948.6µs | 4.63ms | 🟢 4.9x faster |
| txn: cross-atom 1000 selectors, with subs | 1.48ms | 25.32ms | 🟢 17.1x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 313ns | 430ns | 1.4x faster |
| selectorFamily(id) | 327ns | 412ns | 1.3x faster |
| createStore | 411ns | 7.4µs | 18.0x faster |
| sub + unsub | 332ns | 2.5µs | 7.6x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 340ns |
| obj.value = n | 4ns |
| map.set(key, n) | 15ns |
| valdres set | 426ns |
| jotai set | 3.1µs |

> Last updated: 2026-04-08 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
