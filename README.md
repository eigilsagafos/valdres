# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 5ns | 69ns | 🟢 13.9x faster |
| store.get(atom) | 32ns | 94ns | 🟢 3.0x faster |
| set(atom, value) | 758ns | 1.3µs | 🟢 1.7x faster |
| set(atom, curr => curr+1) | 779ns | 1.3µs | 🟢 1.7x faster |
| atomFamily(id) | 693ns | 483ns | 🟡 1.4x slower |
| set + read 10 selectors | 9.7µs | 9.2µs | 🟡 1.0x slower |
| set + read 100 selectors | 75.9µs | 71.1µs | 🟡 1.1x slower |
| set + read through 5 chained selectors | 6.0µs | 6.1µs | 🟢 1.0x faster |
| createStore | 661ns | 233ns | 🔴 2.8x slower |
| set 1000 atoms | 74.5µs | 259.5µs | 🟢 3.5x faster |
| get 1000 atoms | 11.4µs | 81.6µs | 🟢 7.1x faster |
| sub + unsub | 270ns | 1.2µs | 🟢 4.5x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 3ns |
| valdres get | 6ns |
| jotai get | 53ns |
| obj.value = n | 1ns |
| map.set(key, n) | 17ns |
| valdres set | 731ns |
| jotai set | 1.3µs |

> Last updated: 2026-04-03 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
