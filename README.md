# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 4ns | 54ns | 🟢 15.2x faster |
| store.get(atom) | 41ns | 82ns | 🟢 2.0x faster |
| set(atom, value) | 725ns | 1.3µs | 🟢 1.7x faster |
| set(atom, curr => curr+1) | 724ns | 1.2µs | 🟢 1.7x faster |
| atomFamily(id) | 708ns | 450ns | 🟡 1.6x slower |
| set + read 10 selectors | 9.2µs | 7.9µs | 🟡 1.2x slower |
| set + read 100 selectors | 83.5µs | 65.4µs | 🟡 1.3x slower |
| set + read through 5 chained selectors | 6.9µs | 5.4µs | 🟡 1.3x slower |
| createStore | 596ns | 205ns | 🔴 2.9x slower |
| set 1000 atoms | 76.8µs | 293.0µs | 🟢 3.8x faster |
| get 1000 atoms | 10.8µs | 73.5µs | 🟢 6.8x faster |
| sub + unsub | 253ns | 1.1µs | 🟢 4.3x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 8ns |
| jotai get | 50ns |
| obj.value = n | 1ns |
| map.set(key, n) | 19ns |
| valdres set | 645ns |
| jotai set | 1.2µs |

> Last updated: 2026-04-02 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
