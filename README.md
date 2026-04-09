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
| atom(1) | 5ns | 65ns | 🟢 13.0x faster |
| store.get(atom) | 26ns | 360ns | 🟢 13.8x faster |
| set(atom, value) | 236ns | 2.1µs | 🟢 9.1x faster |
| set(atom, curr => curr+1) | 265ns | 2.7µs | 🟢 10.0x faster |
| set(atom) with 10 subs | 596ns | 3.6µs | 🟢 6.0x faster |
| atom lifecycle (create+100get+100set) | 27.9µs | 280.5µs | 🟢 10.1x faster |
| set 1000 atoms | 85.5µs | 1.15ms | 🟢 13.5x faster |
| get 1000 atoms | 6.7µs | 427.4µs | 🟢 63.6x faster |

#### Selectors

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| selector(fn) | 9ns | 84ns | 🟢 9.6x faster |
| set + read 10 selectors | 9.2µs | 28.5µs | 🟢 3.1x faster |
| set + read 100 selectors | 87.4µs | 319.0µs | 🟢 3.7x faster |
| set + read through 5 chained selectors | 7.9µs | 17.6µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 91.7µs | 297.1µs | 🟢 3.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 111.5µs | 586.2µs | 🟢 5.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 766.3µs | 3.28ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, set + read | 920.0µs | 4.69ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.18ms | 24.82ms | 🟢 21.1x faster |

#### Families

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 44ns | 12ns | 🔴 3.7x slower |

#### Not yet optimized

These operations are functional but not yet tuned for speed. Tracked for future improvement.

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 312ns | 432ns | 🟢 1.4x faster |
| selectorFamily(id) | 327ns | 423ns | 🟢 1.3x faster |
| createStore | 557ns | 7.3µs | 🟢 13.2x faster |
| sub + unsub | 495ns | 2.7µs | 🟢 5.4x faster |

<details>
<summary>Baseline (raw JS operations for reference)</summary>

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 17ns |
| valdres get | 8ns |
| jotai get | 339ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 251ns |
| jotai set | 3.1µs |

</details>

> Last updated: 2026-04-09 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
