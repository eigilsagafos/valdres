# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 45ns | 🟢 18.7x faster |
| store.get(atom) | 29ns | 78ns | 🟢 2.7x faster |
| set(atom, value) | 223ns | 1.0µs | 🟢 4.6x faster |
| set(atom, curr => curr+1) | 221ns | 1.0µs | 🟢 4.6x faster |
| atomFamily(id) | 361ns | 444ns | 🟢 1.2x faster |
| selectorFamily(id) | 265ns | 435ns | 🟢 1.6x faster |
| selector(fn) | 6ns | 53ns | 🟢 8.7x faster |
| set + read 10 selectors | 5.1µs | 9.3µs | 🟢 1.8x faster |
| set + read 100 selectors | 42.1µs | 74.7µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.9µs | 5.6µs | 🟢 1.2x faster |
| createStore | 165ns | 194ns | 🟢 1.2x faster |
| set 1000 atoms | 65.2µs | 319.8µs | 🟢 4.9x faster |
| get 1000 atoms | 6.1µs | 131.7µs | 🟢 21.7x faster |
| sub + unsub | 271ns | 938ns | 🟢 3.5x faster |
| txn: 10 atoms × 10 selectors, set + read | 54.6µs | 74.2µs | 🟢 1.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 59.8µs | 203.6µs | 🟢 3.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 476.5µs | 978.8µs | 🟢 2.1x faster |
| txn: cross-atom 1000 selectors, set + read | 550.7µs | 1.51ms | 🟢 2.7x faster |
| txn: cross-atom 1000 selectors, with subs | 690.3µs | 6.10ms | 🟢 8.8x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 14ns |
| valdres get | 7ns |
| jotai get | 104ns |
| obj.value = n | 4ns |
| map.set(key, n) | 14ns |
| valdres set | 401ns |
| jotai set | 1.4µs |

> Last updated: 2026-04-04 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
