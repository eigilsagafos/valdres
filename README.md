# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 54ns | 🟢 17.4x faster |
| store.get(atom) | 43ns | 83ns | 🟢 1.9x faster |
| set(atom, value) | 702ns | 1.2µs | 🟢 1.7x faster |
| set(atom, curr => curr+1) | 693ns | 1.3µs | 🟢 1.8x faster |
| atomFamily(id) | 687ns | 477ns | 🟡 1.4x slower |
| set + read 10 selectors | 9.1µs | 7.9µs | 🟡 1.2x slower |
| set + read 100 selectors | 81.2µs | 65.4µs | 🟡 1.2x slower |
| set + read through 5 chained selectors | 6.6µs | 5.5µs | 🟡 1.2x slower |
| createStore | 631ns | 211ns | 🔴 3.0x slower |
| set 1000 atoms | 76.9µs | 251.8µs | 🟢 3.3x faster |
| get 1000 atoms | 10.9µs | 74.1µs | 🟢 6.8x faster |
| sub + unsub | 254ns | 1.1µs | 🟢 4.2x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 5ns |
| jotai get | 51ns |
| obj.value = n | 1ns |
| map.set(key, n) | 16ns |
| valdres set | 667ns |
| jotai set | 1.2µs |

> Last updated: 2026-04-03 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
