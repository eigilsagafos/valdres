# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0 on the same CI runner.

#### Atoms

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 54ns | 🟢 21.2x faster |
| store.get(atom) | 40ns | 380ns | 🟢 9.5x faster |
| set(atom, value) | 230ns | 2.2µs | 🟢 9.6x faster |
| set(atom, curr => curr+1) | 248ns | 2.8µs | 🟢 11.3x faster |
| set(atom) with 10 subs | 574ns | 3.8µs | 🟢 6.6x faster |
| atom lifecycle (create+100get+100set) | 33.7µs | 290.8µs | 🟢 8.6x faster |
| set 1000 atoms | 87.4µs | 1.17ms | 🟢 13.4x faster |
| get 1000 atoms | 7.2µs | 385.7µs | 🟢 53.6x faster |

#### Selectors

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 60ns | 🟢 9.3x faster |
| set + read 10 selectors | 9.4µs | 29.0µs | 🟢 3.1x faster |
| set + read 100 selectors | 88.5µs | 339.8µs | 🟢 3.8x faster |
| set + read through 5 chained selectors | 8.7µs | 18.4µs | 🟢 2.1x faster |

#### Transactions

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 93.5µs | 411.3µs | 🟢 4.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 150.2µs | 710.3µs | 🟢 4.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 814.9µs | 4.58ms | 🟢 5.6x faster |
| txn: cross-atom 1000 selectors, set + read | 967.1µs | 4.95ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.50ms | 25.89ms | 🟢 17.3x faster |

#### Families

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 53ns | 11ns | 🔴 4.8x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 412ns | 532ns | 🟢 1.3x faster |
| selectorFamily(id) | 393ns | 522ns | 🟢 1.3x faster |
| createStore | 660ns | 6.7µs | 🟢 10.1x faster |
| sub + unsub | 471ns | 2.5µs | 🟢 5.4x faster |

<details>
<summary>Baseline (raw JS operations for reference)</summary>

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 9ns |
| jotai get | 382ns |
| obj.value = n | 5ns |
| map.set(key, n) | 18ns |
| valdres set | 241ns |
| jotai set | 3.4µs |

</details>

> Last updated: 2026-04-09 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
