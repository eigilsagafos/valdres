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
| atom(1) | 3ns | 50ns | 🟢 19.6x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 240ns | 2.1µs | 🟢 8.8x faster |
| set(atom, curr => curr+1) | 258ns | 2.7µs | 🟢 10.5x faster |
| set(atom) with 10 subs | 562ns | 3.6µs | 🟢 6.4x faster |
| atom lifecycle (create+100get+100set) | 26.6µs | 280.8µs | 🟢 10.6x faster |
| set 1000 atoms | 88.5µs | 1.20ms | 🟢 13.6x faster |
| get 1000 atoms | 6.7µs | 376.1µs | 🟢 56.2x faster |

#### Selectors

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 57ns | 🟢 11.7x faster |
| set + read 10 selectors | 9.7µs | 30.9µs | 🟢 3.2x faster |
| set + read 100 selectors | 91.4µs | 333.6µs | 🟢 3.6x faster |
| set + read through 5 chained selectors | 8.5µs | 18.2µs | 🟢 2.1x faster |

#### Transactions

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 96.8µs | 420.9µs | 🟢 4.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 150.5µs | 746.3µs | 🟢 5.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 832.9µs | 4.47ms | 🟢 5.4x faster |
| txn: cross-atom 1000 selectors, set + read | 1.01ms | 4.86ms | 🟢 4.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.52ms | 25.67ms | 🟢 16.9x faster |

#### Families

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 47ns | 11ns | 🔴 4.4x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 329ns | 456ns | 🟢 1.4x faster |
| selectorFamily(id) | 340ns | 455ns | 🟢 1.3x faster |
| createStore | 619ns | 6.4µs | 🟢 10.4x faster |
| sub + unsub | 491ns | 2.5µs | 🟢 5.1x faster |

<details>
<summary>Baseline (raw JS operations for reference)</summary>

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 19ns |
| valdres get | 8ns |
| jotai get | 368ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 241ns |
| jotai set | 3.3µs |

</details>

> Last updated: 2026-04-08 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
