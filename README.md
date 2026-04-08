# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 54ns | 🟢 21.8x faster |
| store.get(atom) | 40ns | 380ns | 🟢 9.5x faster |
| set(atom, value) | 251ns | 2.2µs | 🟢 8.6x faster |
| set(atom, curr => curr+1) | 267ns | 2.8µs | 🟢 10.6x faster |
| set(atom) with 10 subs | 571ns | 3.7µs | 🟢 6.5x faster |
| atom lifecycle (create+100get+100set) | 27.7µs | 290.7µs | 🟢 10.5x faster |
| atomFamily(id) cache hit | 55ns | 11ns | 🔴 4.9x slower |
| selector(fn) | 7ns | 63ns | 🟢 8.4x faster |
| set + read 10 selectors | 9.1µs | 28.2µs | 🟢 3.1x faster |
| set + read 100 selectors | 85.4µs | 347.6µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 8.5µs | 18.9µs | 🟢 2.2x faster |
| set 1000 atoms | 93.7µs | 1.20ms | 🟢 12.8x faster |
| get 1000 atoms | 9.6µs | 581.1µs | 🟢 60.8x faster |
| txn: 10 atoms × 10 selectors, set + read | 93.4µs | 316.8µs | 🟢 3.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 147.2µs | 633.1µs | 🟢 4.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 863.9µs | 3.52ms | 🟢 4.1x faster |
| txn: cross-atom 1000 selectors, set + read | 1.00ms | 5.15ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.47ms | 26.92ms | 🟢 18.3x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 375ns | 513ns | 1.4x faster |
| selectorFamily(id) | 383ns | 516ns | 1.3x faster |
| createStore | 555ns | 6.7µs | 12.1x faster |
| sub + unsub | 480ns | 2.5µs | 5.2x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 17ns |
| valdres get | 8ns |
| jotai get | 358ns |
| obj.value = n | 5ns |
| map.set(key, n) | 18ns |
| valdres set | 533ns |
| jotai set | 3.5µs |

> Last updated: 2026-04-08 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
