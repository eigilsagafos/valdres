# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 28ns | 🟢 11.7x faster |
| store.get(atom) | 2ns | 167ns | 🟢 98.9x faster |
| set(atom, value) | 128ns | 968ns | 🟢 7.5x faster |
| set(atom, curr => curr+1) | 164ns | 1.1µs | 🟢 6.7x faster |
| set(atom) with 10 subs | 297ns | 1.5µs | 🟢 5.1x faster |
| atom lifecycle (create+100get+100set) | 17.8µs | 120.7µs | 🟢 6.8x faster |
| atomFamily(id) cache hit | 19ns | 5ns | 🔴 3.4x slower |
| selector(fn) | 7ns | 32ns | 🟢 4.8x faster |
| set + read 10 selectors | 3.0µs | 11.8µs | 🟢 3.9x faster |
| set + read 100 selectors | 31.1µs | 96.0µs | 🟢 3.1x faster |
| set + read through 5 chained selectors | 2.4µs | 6.3µs | 🟢 2.7x faster |
| set 1000 atoms | 55.0µs | 449.1µs | 🟢 8.2x faster |
| get 1000 atoms | 4.0µs | 196.0µs | 🟢 48.5x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 209ns | 255ns | 1.2x faster |
| selectorFamily(id) | 201ns | 241ns | 1.2x faster |
| createStore | 115ns | 3.4µs | 29.7x faster |
| sub + unsub | 160ns | 1.1µs | 6.8x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 2ns |
| map.get(key) | 10ns |
| valdres get | 5ns |
| jotai get | 175ns |
| obj.value = n | 2ns |
| map.set(key, n) | 10ns |
| valdres set | 164ns |
| jotai set | 1.1µs |

> Last updated: 2026-04-04 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
