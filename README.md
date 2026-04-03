# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 57ns | 🟢 20.3x faster |
| store.get(atom) | 40ns | 83ns | 🟢 2.1x faster |
| set(atom, value) | 698ns | 1.2µs | 🟢 1.7x faster |
| set(atom, curr => curr+1) | 710ns | 1.2µs | 🟢 1.7x faster |
| atomFamily(id) | 681ns | 435ns | 🟡 1.6x slower |
| set + read 10 selectors | 9.7µs | 7.5µs | 🟡 1.3x slower |
| set + read 100 selectors | 81.5µs | 63.4µs | 🟡 1.3x slower |
| set + read through 5 chained selectors | 6.7µs | 5.3µs | 🟡 1.3x slower |
| createStore | 146ns | 203ns | 🟢 1.4x faster |
| set 1000 atoms | 81.3µs | 254.3µs | 🟢 3.1x faster |
| get 1000 atoms | 10.2µs | 72.9µs | 🟢 7.1x faster |
| sub + unsub | 231ns | 990ns | 🟢 4.3x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 6ns |
| jotai get | 51ns |
| obj.value = n | 2ns |
| map.set(key, n) | 19ns |
| valdres set | 720ns |
| jotai set | 1.4µs |

> Last updated: 2026-04-03 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
