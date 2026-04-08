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
| atom(1) | 2ns | 49ns | 🟢 21.4x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 240ns | 2.1µs | 🟢 8.9x faster |
| set(atom, curr => curr+1) | 266ns | 2.7µs | 🟢 10.2x faster |
| set(atom) with 10 subs | 559ns | 3.5µs | 🟢 6.3x faster |
| atom lifecycle (create+100get+100set) | 25.2µs | 282.7µs | 🟢 11.2x faster |
| set 1000 atoms | 88.5µs | 1.22ms | 🟢 13.8x faster |
| get 1000 atoms | 6.5µs | 434.6µs | 🟢 66.6x faster |

#### Selectors

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 57ns | 🟢 11.3x faster |
| set + read 10 selectors | 9.7µs | 31.0µs | 🟢 3.2x faster |
| set + read 100 selectors | 91.3µs | 336.2µs | 🟢 3.7x faster |
| set + read through 5 chained selectors | 8.5µs | 18.5µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 97.5µs | 308.9µs | 🟢 3.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 156.0µs | 657.7µs | 🟢 4.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 851.8µs | 3.39ms | 🟢 4.0x faster |
| txn: cross-atom 1000 selectors, set + read | 970.8µs | 4.85ms | 🟢 5.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.52ms | 24.76ms | 🟢 16.3x faster |

#### Families

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.4x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 273ns | 452ns | 🟢 1.7x faster |
| selectorFamily(id) | 308ns | 442ns | 🟢 1.4x faster |
| createStore | 641ns | 6.5µs | 🟢 10.1x faster |
| sub + unsub | 481ns | 2.5µs | 🟢 5.3x faster |

<details>
<summary>Baseline (raw JS operations for reference)</summary>

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 18ns |
| valdres get | 8ns |
| jotai get | 368ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 449ns |
| jotai set | 3.3µs |

</details>

> Last updated: 2026-04-08 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
