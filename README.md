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
| atom(1) | 5ns | 65ns | 🟢 13.1x faster |
| store.get(atom) | 26ns | 358ns | 🟢 13.8x faster |
| set(atom, value) | 232ns | 2.2µs | 🟢 9.4x faster |
| set(atom, curr => curr+1) | 259ns | 2.7µs | 🟢 10.4x faster |
| set(atom) with 10 subs | 542ns | 3.4µs | 🟢 6.2x faster |
| atom lifecycle (create+100get+100set) | 27.0µs | 276.3µs | 🟢 10.2x faster |
| set 1000 atoms | 87.0µs | 1.16ms | 🟢 13.3x faster |
| get 1000 atoms | 6.7µs | 438.3µs | 🟢 65.7x faster |

#### Selectors

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| selector(fn) | 9ns | 81ns | 🟢 9.4x faster |
| set + read 10 selectors | 9.0µs | 28.6µs | 🟢 3.2x faster |
| set + read 100 selectors | 90.9µs | 323.7µs | 🟢 3.6x faster |
| set + read through 5 chained selectors | 8.0µs | 17.6µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 99.2µs | 302.1µs | 🟢 3.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 151.1µs | 619.8µs | 🟢 4.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 832.1µs | 3.41ms | 🟢 4.1x faster |
| txn: cross-atom 1000 selectors, set + read | 984.0µs | 4.96ms | 🟢 5.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.61ms | 27.80ms | 🟢 17.3x faster |

#### Families

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 44ns | 11ns | 🔴 4.0x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 289ns | 419ns | 🟢 1.5x faster |
| selectorFamily(id) | 320ns | 410ns | 🟢 1.3x faster |
| createStore | 683ns | 7.8µs | 🟢 11.4x faster |
| sub + unsub | 560ns | 2.6µs | 🟢 4.7x faster |

<details>
<summary>Baseline (raw JS operations for reference)</summary>

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 341ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 408ns |
| jotai set | 3.0µs |

</details>

> Last updated: 2026-04-09 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
