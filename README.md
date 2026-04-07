# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 52ns | 🟢 19.6x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 251ns | 2.1µs | 🟢 8.5x faster |
| set(atom, curr => curr+1) | 251ns | 2.8µs | 🟢 11.0x faster |
| set(atom) with 10 subs | 578ns | 3.5µs | 🟢 6.1x faster |
| atom lifecycle (create+100get+100set) | 33.2µs | 282.9µs | 🟢 8.5x faster |
| atomFamily(id) cache hit | 47ns | 11ns | 🔴 4.4x slower |
| selector(fn) | 6ns | 71ns | 🟢 11.2x faster |
| set + read 10 selectors | 9.3µs | 31.8µs | 🟢 3.4x faster |
| set + read 100 selectors | 84.5µs | 333.8µs | 🟢 3.9x faster |
| set + read through 5 chained selectors | 8.6µs | 18.4µs | 🟢 2.1x faster |
| set 1000 atoms | 97.2µs | 1.24ms | 🟢 12.8x faster |
| get 1000 atoms | 7.7µs | 375.1µs | 🟢 48.7x faster |
| txn: 10 atoms × 10 selectors, set + read | 93.3µs | 432.6µs | 🟢 4.6x faster |
| txn: 10 atoms × 10 selectors, with subs | 153.8µs | 743.3µs | 🟢 4.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 821.8µs | 4.53ms | 🟢 5.5x faster |
| txn: cross-atom 1000 selectors, set + read | 971.3µs | 4.77ms | 🟢 4.9x faster |
| txn: cross-atom 1000 selectors, with subs | 1.50ms | 24.70ms | 🟢 16.5x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 299ns | 462ns | 1.5x faster |
| selectorFamily(id) | 328ns | 451ns | 1.4x faster |
| createStore | 487ns | 6.5µs | 13.4x faster |
| sub + unsub | 391ns | 2.5µs | 6.5x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 19ns |
| valdres get | 8ns |
| jotai get | 368ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 474ns |
| jotai set | 3.3µs |

> Last updated: 2026-04-07 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
