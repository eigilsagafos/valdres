# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 4ns | 61ns | 🟢 17.3x faster |
| store.get(atom) | 27ns | 359ns | 🟢 13.3x faster |
| set(atom, value) | 236ns | 2.2µs | 🟢 9.1x faster |
| set(atom, curr => curr+1) | 258ns | 2.7µs | 🟢 10.3x faster |
| set(atom) with 10 subs | 579ns | 3.5µs | 🟢 6.1x faster |
| atom lifecycle (create+100get+100set) | 26.9µs | 277.7µs | 🟢 10.3x faster |
| atomFamily(id) cache hit | 44ns | 11ns | 🔴 4.0x slower |
| selector(fn) | 8ns | 83ns | 🟢 9.9x faster |
| set + read 10 selectors | 9.0µs | 29.3µs | 🟢 3.3x faster |
| set + read 100 selectors | 86.6µs | 314.5µs | 🟢 3.6x faster |
| set + read through 5 chained selectors | 7.9µs | 16.9µs | 🟢 2.1x faster |
| set 1000 atoms | 85.8µs | 1.15ms | 🟢 13.4x faster |
| get 1000 atoms | 3.9µs | 410.5µs | 🟢 105.7x faster |
| txn: 10 atoms × 10 selectors, set + read | 91.1µs | 291.8µs | 🟢 3.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 138.9µs | 576.9µs | 🟢 4.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 776.5µs | 3.23ms | 🟢 4.2x faster |
| txn: cross-atom 1000 selectors, set + read | 936.9µs | 4.61ms | 🟢 4.9x faster |
| txn: cross-atom 1000 selectors, with subs | 1.44ms | 23.98ms | 🟢 16.7x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 300ns | 416ns | 1.4x faster |
| selectorFamily(id) | 328ns | 406ns | 1.2x faster |
| createStore | 530ns | 7.2µs | 13.7x faster |
| sub + unsub | 490ns | 2.6µs | 5.3x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 7ns |
| jotai get | 344ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 404ns |
| jotai set | 3.1µs |

> Last updated: 2026-04-08 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
