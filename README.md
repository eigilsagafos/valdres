# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 41ns | 🟢 21.6x faster |
| store.get(atom) | 30ns | 291ns | 🟢 9.7x faster |
| set(atom, value) | 190ns | 1.7µs | 🟢 9.1x faster |
| set(atom, curr => curr+1) | 211ns | 2.4µs | 🟢 11.2x faster |
| set(atom) with 10 subs | 431ns | 3.0µs | 🟢 7.0x faster |
| atom lifecycle (create+100get+100set) | 22.3µs | 227.2µs | 🟢 10.2x faster |
| atomFamily(id) cache hit | 41ns | 9ns | 🔴 4.8x slower |
| selector(fn) | 6ns | 50ns | 🟢 8.9x faster |
| set + read 10 selectors | 4.8µs | 25.4µs | 🟢 5.3x faster |
| set + read 100 selectors | 35.4µs | 215.9µs | 🟢 6.1x faster |
| set + read through 5 chained selectors | 4.2µs | 11.7µs | 🟢 2.8x faster |
| set 1000 atoms | 63.4µs | 759.3µs | 🟢 12.0x faster |
| get 1000 atoms | 6.0µs | 285.2µs | 🟢 47.4x faster |
| txn: 10 atoms × 10 selectors, set + read | 47.2µs | 214.0µs | 🟢 4.5x faster |
| txn: 10 atoms × 10 selectors, with subs | 84.1µs | 461.8µs | 🟢 5.5x faster |
| txn: 10 atoms × 100 selectors, set + read | 436.8µs | 2.39ms | 🟢 5.5x faster |
| txn: cross-atom 1000 selectors, set + read | 515.0µs | 3.18ms | 🟢 6.2x faster |
| txn: cross-atom 1000 selectors, with subs | 623.4µs | 16.75ms | 🟢 26.9x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 261ns | 413ns | 1.6x faster |
| selectorFamily(id) | 277ns | 409ns | 1.5x faster |
| createStore | 428ns | 5.1µs | 12.0x faster |
| sub + unsub | 733ns | 2.1µs | 2.8x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 13ns |
| valdres get | 7ns |
| jotai get | 278ns |
| obj.value = n | 4ns |
| map.set(key, n) | 14ns |
| valdres set | 181ns |
| jotai set | 2.0µs |

> Last updated: 2026-04-04 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
