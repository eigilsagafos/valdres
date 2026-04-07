# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 53ns | 🟢 21.3x faster |
| store.get(atom) | 40ns | 380ns | 🟢 9.5x faster |
| set(atom, value) | 250ns | 2.2µs | 🟢 8.7x faster |
| set(atom, curr => curr+1) | 273ns | 2.8µs | 🟢 10.4x faster |
| set(atom) with 10 subs | 530ns | 3.8µs | 🟢 7.3x faster |
| atom lifecycle (create+100get+100set) | 25.0µs | 292.6µs | 🟢 11.7x faster |
| atomFamily(id) cache hit | 53ns | 11ns | 🔴 4.8x slower |
| selector(fn) | 9ns | 64ns | 🟢 7.0x faster |
| set + read 10 selectors | 9.2µs | 31.1µs | 🟢 3.4x faster |
| set + read 100 selectors | 85.4µs | 341.1µs | 🟢 4.0x faster |
| set + read through 5 chained selectors | 10.9µs | 18.6µs | 🟢 1.7x faster |
| set 1000 atoms | 117.0µs | 1.19ms | 🟢 10.2x faster |
| get 1000 atoms | 7.8µs | 367.7µs | 🟢 47.3x faster |
| txn: 10 atoms × 10 selectors, set + read | 89.4µs | 410.4µs | 🟢 4.6x faster |
| txn: 10 atoms × 10 selectors, with subs | 148.6µs | 722.1µs | 🟢 4.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 840.0µs | 4.64ms | 🟢 5.5x faster |
| txn: cross-atom 1000 selectors, set + read | 991.6µs | 4.93ms | 🟢 5.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.51ms | 25.57ms | 🟢 17.0x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 366ns | 514ns | 1.4x faster |
| selectorFamily(id) | 379ns | 512ns | 1.3x faster |
| createStore | 494ns | 6.8µs | 13.7x faster |
| sub + unsub | 340ns | 2.4µs | 7.1x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 359ns |
| obj.value = n | 5ns |
| map.set(key, n) | 18ns |
| valdres set | 480ns |
| jotai set | 3.5µs |

> Last updated: 2026-04-07 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
