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
| atom(1) | 5ns | 66ns | 🟢 12.3x faster |
| store.get(atom) | 26ns | 358ns | 🟢 13.8x faster |
| set(atom, value) | 234ns | 2.2µs | 🟢 9.3x faster |
| set(atom, curr => curr+1) | 263ns | 2.7µs | 🟢 10.2x faster |
| set(atom) with 10 subs | 595ns | 3.6µs | 🟢 6.1x faster |
| atom lifecycle (create+100get+100set) | 28.2µs | 282.5µs | 🟢 10.0x faster |
| set 1000 atoms | 85.2µs | 1.13ms | 🟢 13.2x faster |
| get 1000 atoms | 6.8µs | 418.5µs | 🟢 61.7x faster |

#### Selectors

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| selector(fn) | 9ns | 69ns | 🟢 7.8x faster |
| set + read 10 selectors | 8.8µs | 28.5µs | 🟢 3.2x faster |
| set + read 100 selectors | 83.6µs | 306.0µs | 🟢 3.7x faster |
| set + read through 5 chained selectors | 8.0µs | 16.6µs | 🟢 2.1x faster |

#### Transactions

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 87.1µs | 290.0µs | 🟢 3.3x faster |
| txn: 10 atoms × 10 selectors, with subs | 137.0µs | 566.3µs | 🟢 4.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 750.7µs | 3.09ms | 🟢 4.1x faster |
| txn: cross-atom 1000 selectors, set + read | 909.8µs | 4.48ms | 🟢 4.9x faster |
| txn: cross-atom 1000 selectors, with subs | 1.42ms | 23.86ms | 🟢 16.8x faster |

#### Families

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 45ns | 11ns | 🔴 4.1x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 330ns | 440ns | 🟢 1.3x faster |
| selectorFamily(id) | 347ns | 428ns | 🟢 1.2x faster |
| createStore | 512ns | 7.3µs | 🟢 14.2x faster |
| sub + unsub | 473ns | 2.5µs | 🟢 5.4x faster |

<details>
<summary>Baseline (raw JS operations for reference)</summary>

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 9ns |
| jotai get | 341ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 412ns |
| jotai set | 3.1µs |

</details>

> Last updated: 2026-04-09 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
