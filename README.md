# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 51ns | 🟢 20.3x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 240ns | 2.2µs | 🟢 9.1x faster |
| set(atom, curr => curr+1) | 256ns | 2.7µs | 🟢 10.6x faster |
| set(atom) with 10 subs | 593ns | 3.6µs | 🟢 6.1x faster |
| atom lifecycle (create+100get+100set) | 26.6µs | 285.6µs | 🟢 10.7x faster |
| atomFamily(id) cache hit | 47ns | 11ns | 🔴 4.4x slower |
| selector(fn) | 6ns | 84ns | 🟢 13.3x faster |
| set + read 10 selectors | 9.0µs | 30.8µs | 🟢 3.4x faster |
| set + read 100 selectors | 86.4µs | 334.3µs | 🟢 3.9x faster |
| set + read through 5 chained selectors | 8.4µs | 18.3µs | 🟢 2.2x faster |
| set 1000 atoms | 88.4µs | 1.22ms | 🟢 13.8x faster |
| get 1000 atoms | 7.3µs | 378.3µs | 🟢 51.9x faster |
| txn: 10 atoms × 10 selectors, set + read | 95.8µs | 431.1µs | 🟢 4.5x faster |
| txn: 10 atoms × 10 selectors, with subs | 152.7µs | 740.5µs | 🟢 4.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 855.5µs | 4.56ms | 🟢 5.3x faster |
| txn: cross-atom 1000 selectors, set + read | 1.04ms | 4.76ms | 🟢 4.6x faster |
| txn: cross-atom 1000 selectors, with subs | 1.47ms | 25.04ms | 🟢 17.0x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 320ns | 473ns | 1.5x faster |
| selectorFamily(id) | 332ns | 446ns | 1.3x faster |
| createStore | 504ns | 6.5µs | 12.9x faster |
| sub + unsub | 390ns | 2.5µs | 6.4x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 17ns |
| valdres get | 8ns |
| jotai get | 371ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 481ns |
| jotai set | 3.4µs |

> Last updated: 2026-04-08 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
