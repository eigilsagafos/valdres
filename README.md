# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 54ns | 🟢 17.8x faster |
| store.get(atom) | 36ns | 91ns | 🟢 2.5x faster |
| set(atom, value) | 286ns | 1.2µs | 🟢 4.2x faster |
| set(atom, curr => curr+1) | 300ns | 1.2µs | 🟢 4.1x faster |
| atomFamily(id) | 690ns | 445ns | 🟡 1.5x slower |
| set + read 10 selectors | 5.3µs | 9.3µs | 🟢 1.8x faster |
| set + read 100 selectors | 46.9µs | 65.0µs | 🟢 1.4x faster |
| set + read through 5 chained selectors | 4.4µs | 5.3µs | 🟢 1.2x faster |
| createStore | 168ns | 218ns | 🟢 1.3x faster |
| set 1000 atoms | 80.3µs | 243.8µs | 🟢 3.0x faster |
| get 1000 atoms | 9.6µs | 75.6µs | 🟢 7.9x faster |
| sub + unsub | 258ns | 1.1µs | 🟢 4.1x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 3ns |
| jotai get | 50ns |
| obj.value = n | 5ns |
| map.set(key, n) | 19ns |
| valdres set | 253ns |
| jotai set | 1.2µs |

> Last updated: 2026-04-03 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
