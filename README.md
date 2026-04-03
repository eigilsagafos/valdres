# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 27ns | 🟢 11.8x faster |
| store.get(atom) | 5ns | 174ns | 🟢 36.5x faster |
| set(atom, value) | 118ns | 860ns | 🟢 7.3x faster |
| set(atom, curr => curr+1) | 156ns | 1.0µs | 🟢 6.7x faster |
| set(atom) with 10 subs | 260ns | 1.1µs | 🟢 4.1x faster |
| atom lifecycle (create+100get+100set) | 15.1µs | 112.6µs | 🟢 7.5x faster |
| atomFamily(id) cache hit | 15ns | 5ns | 🔴 2.7x slower |
| selector(fn) | 5ns | 36ns | 🟢 6.6x faster |
| set + read 10 selectors | 2.8µs | 10.9µs | 🟢 3.9x faster |
| set + read 100 selectors | 28.3µs | 98.3µs | 🟢 3.5x faster |
| set + read through 5 chained selectors | 2.3µs | 5.8µs | 🟢 2.5x faster |
| set 1000 atoms | 55.0µs | 457.7µs | 🟢 8.3x faster |
| get 1000 atoms | 4.1µs | 178.7µs | 🟢 43.8x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 158ns | 207ns | 1.3x faster |
| selectorFamily(id) | 153ns | 196ns | 1.3x faster |
| createStore | 105ns | 3.2µs | 30.3x faster |
| sub + unsub | 156ns | 1.1µs | 7.2x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 2ns |
| map.get(key) | 9ns |
| valdres get | 5ns |
| jotai get | 168ns |
| obj.value = n | 2ns |
| map.set(key, n) | 12ns |
| valdres set | 155ns |
| jotai set | 1.0µs |

> Last updated: 2026-04-03 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
