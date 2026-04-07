# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 50ns | 🟢 19.7x faster |
| store.get(atom) | 40ns | 401ns | 🟢 10.0x faster |
| set(atom, value) | 260ns | 2.2µs | 🟢 8.3x faster |
| set(atom, curr => curr+1) | 280ns | 2.7µs | 🟢 9.7x faster |
| set(atom) with 10 subs | 550ns | 3.8µs | 🟢 6.9x faster |
| atom lifecycle (create+100get+100set) | 25.2µs | 286.2µs | 🟢 11.3x faster |
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.4x slower |
| selector(fn) | 6ns | 71ns | 🟢 11.1x faster |
| set + read 10 selectors | 8.7µs | 31.1µs | 🟢 3.6x faster |
| set + read 100 selectors | 83.6µs | 347.9µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 11.3µs | 18.3µs | 🟢 1.6x faster |
| set 1000 atoms | 95.7µs | 1.21ms | 🟢 12.7x faster |
| get 1000 atoms | 7.6µs | 377.6µs | 🟢 49.7x faster |
| txn: 10 atoms × 10 selectors, set + read | 96.4µs | 433.3µs | 🟢 4.5x faster |
| txn: 10 atoms × 10 selectors, with subs | 152.5µs | 745.3µs | 🟢 4.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 831.5µs | 4.54ms | 🟢 5.5x faster |
| txn: cross-atom 1000 selectors, set + read | 982.7µs | 4.91ms | 🟢 5.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.51ms | 26.04ms | 🟢 17.3x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 304ns | 454ns | 1.5x faster |
| selectorFamily(id) | 296ns | 435ns | 1.5x faster |
| createStore | 488ns | 6.5µs | 13.2x faster |
| sub + unsub | 391ns | 2.6µs | 6.7x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 18ns |
| valdres get | 8ns |
| jotai get | 369ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 451ns |
| jotai set | 3.4µs |

> Last updated: 2026-04-07 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
