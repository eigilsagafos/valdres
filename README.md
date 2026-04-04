# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 54ns | 🟢 15.5x faster |
| store.get(atom) | 36ns | 92ns | 🟢 2.6x faster |
| set(atom, value) | 280ns | 1.2µs | 🟢 4.3x faster |
| set(atom, curr => curr+1) | 301ns | 1.3µs | 🟢 4.2x faster |
| atomFamily(id) | 373ns | 464ns | 🟢 1.2x faster |
| selectorFamily(id) | 345ns | 464ns | 🟢 1.3x faster |
| selector(fn) | 6ns | 67ns | 🟢 11.4x faster |
| set + read 10 selectors | 6.5µs | 12.7µs | 🟢 2.0x faster |
| set + read 100 selectors | 55.2µs | 83.5µs | 🟢 1.5x faster |
| set + read through 5 chained selectors | 5.8µs | 6.9µs | 🟢 1.2x faster |
| createStore | 405ns | 249ns | 🟡 1.6x slower |
| set 1000 atoms | 91.6µs | 421.1µs | 🟢 4.6x faster |
| get 1000 atoms | 7.8µs | 154.6µs | 🟢 19.9x faster |
| sub + unsub | 407ns | 1.2µs | 🟢 3.0x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 17ns |
| valdres get | 9ns |
| jotai get | 129ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 472ns |
| jotai set | 2.0µs |

> Last updated: 2026-04-04 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
