# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 57ns | 🟢 17.1x faster |
| store.get(atom) | 36ns | 89ns | 🟢 2.5x faster |
| set(atom, value) | 273ns | 1.2µs | 🟢 4.5x faster |
| set(atom, curr => curr+1) | 304ns | 1.3µs | 🟢 4.2x faster |
| atomFamily(id) | 356ns | 470ns | 🟢 1.3x faster |
| selectorFamily(id) | 427ns | 1.1µs | 🟢 2.6x faster |
| selector(fn) | 5ns | 60ns | 🟢 11.2x faster |
| set + read 10 selectors | 6.4µs | 9.6µs | 🟢 1.5x faster |
| set + read 100 selectors | 52.3µs | 92.2µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.9µs | 5.8µs | 🟢 1.2x faster |
| createStore | 207ns | 217ns | 🟢 1.0x faster |
| set 1000 atoms | 92.6µs | 339.4µs | 🟢 3.7x faster |
| get 1000 atoms | 7.4µs | 108.6µs | 🟢 14.7x faster |
| sub + unsub | 288ns | 1.1µs | 🟢 3.8x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 17ns |
| valdres get | 9ns |
| jotai get | 119ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 430ns |
| jotai set | 1.3µs |

> Last updated: 2026-04-03 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
