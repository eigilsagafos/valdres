# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 4ns | 59ns | 🟢 15.4x faster |
| store.get(atom) | 41ns | 86ns | 🟢 2.1x faster |
| set(atom, value) | 697ns | 1.2µs | 🟢 1.7x faster |
| set(atom, curr => curr+1) | 732ns | 1.3µs | 🟢 1.7x faster |
| atomFamily(id) | 704ns | 453ns | 🟡 1.6x slower |
| set + read 10 selectors | 9.8µs | 7.8µs | 🟡 1.2x slower |
| set + read 100 selectors | 85.7µs | 64.0µs | 🟡 1.3x slower |
| set + read through 5 chained selectors | 6.7µs | 5.5µs | 🟡 1.2x slower |
| createStore | 151ns | 203ns | 🟢 1.3x faster |
| set 1000 atoms | 83.4µs | 268.3µs | 🟢 3.2x faster |
| get 1000 atoms | 10.0µs | 75.6µs | 🟢 7.6x faster |
| sub + unsub | 238ns | 1.0µs | 🟢 4.3x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 8ns |
| jotai get | 50ns |
| obj.value = n | 1ns |
| map.set(key, n) | 19ns |
| valdres set | 668ns |
| jotai set | 1.2µs |

> Last updated: 2026-04-03 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
