# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 55ns | 🟢 22.0x faster |
| store.get(atom) | 40ns | 380ns | 🟢 9.5x faster |
| set(atom, value) | 250ns | 2.1µs | 🟢 8.5x faster |
| set(atom, curr => curr+1) | 254ns | 2.8µs | 🟢 11.0x faster |
| set(atom) with 10 subs | 600ns | 3.9µs | 🟢 6.5x faster |
| atom lifecycle (create+100get+100set) | 27.2µs | 291.5µs | 🟢 10.7x faster |
| atomFamily(id) cache hit | 54ns | 11ns | 🔴 4.9x slower |
| selector(fn) | 9ns | 64ns | 🟢 7.4x faster |
| set + read 10 selectors | 8.9µs | 28.5µs | 🟢 3.2x faster |
| set + read 100 selectors | 84.4µs | 340.6µs | 🟢 4.0x faster |
| set + read through 5 chained selectors | 8.6µs | 18.3µs | 🟢 2.1x faster |
| set 1000 atoms | 95.4µs | 1.21ms | 🟢 12.6x faster |
| get 1000 atoms | 7.7µs | 367.9µs | 🟢 47.9x faster |
| txn: 10 atoms × 10 selectors, set + read | 87.8µs | 409.3µs | 🟢 4.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 148.3µs | 712.0µs | 🟢 4.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 808.8µs | 4.54ms | 🟢 5.6x faster |
| txn: cross-atom 1000 selectors, set + read | 946.3µs | 4.91ms | 🟢 5.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.48ms | 25.98ms | 🟢 17.6x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 387ns | 529ns | 1.4x faster |
| selectorFamily(id) | 388ns | 518ns | 1.3x faster |
| createStore | 492ns | 6.7µs | 13.7x faster |
| sub + unsub | 870ns | 2.5µs | 2.8x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 17ns |
| valdres get | 8ns |
| jotai get | 359ns |
| obj.value = n | 5ns |
| map.set(key, n) | 18ns |
| valdres set | 514ns |
| jotai set | 3.5µs |

> Last updated: 2026-04-07 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
