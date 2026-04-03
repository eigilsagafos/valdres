# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 5ns | 68ns | 🟢 14.9x faster |
| store.get(atom) | 28ns | 97ns | 🟢 3.4x faster |
| set(atom, value) | 331ns | 1.2µs | 🟢 3.6x faster |
| set(atom, curr => curr+1) | 305ns | 1.2µs | 🟢 4.1x faster |
| atomFamily(id) | 373ns | 453ns | 🟢 1.2x faster |
| selectorFamily(id) | 309ns | 441ns | 🟢 1.4x faster |
| selector(fn) | 10ns | 73ns | 🟢 7.7x faster |
| set + read 10 selectors | 6.3µs | 10.8µs | 🟢 1.7x faster |
| set + read 100 selectors | 55.8µs | 80.5µs | 🟢 1.4x faster |
| set + read through 5 chained selectors | 5.2µs | 6.0µs | 🟢 1.2x faster |
| createStore | 329ns | 246ns | 🟡 1.3x slower |
| set 1000 atoms | 84.3µs | 357.2µs | 🟢 4.2x faster |
| get 1000 atoms | 7.3µs | 131.3µs | 🟢 17.9x faster |
| sub + unsub | 288ns | 1.2µs | 🟢 4.2x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 15ns |
| valdres get | 8ns |
| jotai get | 98ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 432ns |
| jotai set | 1.5µs |

> Last updated: 2026-04-03 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
