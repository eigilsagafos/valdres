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
| atom(1) | 5ns | 65ns | 🟢 13.9x faster |
| store.get(atom) | 26ns | 354ns | 🟢 13.6x faster |
| set(atom, value) | 234ns | 2.1µs | 🟢 9.2x faster |
| set(atom, curr => curr+1) | 265ns | 2.7µs | 🟢 10.1x faster |
| set(atom) with 10 subs | 584ns | 3.4µs | 🟢 5.9x faster |
| atom lifecycle (create+100get+100set) | 27.6µs | 277.3µs | 🟢 10.1x faster |
| set 1000 atoms | 84.0µs | 1.16ms | 🟢 13.8x faster |
| get 1000 atoms | 3.9µs | 416.8µs | 🟢 105.6x faster |

#### Selectors

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| selector(fn) | 9ns | 88ns | 🟢 9.9x faster |
| set + read 10 selectors | 8.8µs | 28.9µs | 🟢 3.3x faster |
| set + read 100 selectors | 84.0µs | 312.2µs | 🟢 3.7x faster |
| set + read through 5 chained selectors | 7.9µs | 17.1µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 87.5µs | 295.1µs | 🟢 3.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 139.0µs | 586.7µs | 🟢 4.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 780.1µs | 3.22ms | 🟢 4.1x faster |
| txn: cross-atom 1000 selectors, set + read | 969.2µs | 4.65ms | 🟢 4.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.44ms | 24.95ms | 🟢 17.3x faster |

#### Families

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 44ns | 11ns | 🔴 4.0x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 312ns | 428ns | 🟢 1.4x faster |
| selectorFamily(id) | 329ns | 414ns | 🟢 1.3x faster |
| createStore | 540ns | 7.3µs | 🟢 13.6x faster |
| sub + unsub | 476ns | 2.6µs | 🟢 5.5x faster |

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
| valdres set | 407ns |
| jotai set | 3.1µs |

</details>

> Last updated: 2026-04-09 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
