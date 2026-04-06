# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 52ns | 🟢 23.4x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 251ns | 2.2µs | 🟢 8.7x faster |
| set(atom, curr => curr+1) | 283ns | 3.0µs | 🟢 10.5x faster |
| set(atom) with 10 subs | 551ns | 3.6µs | 🟢 6.6x faster |
| atom lifecycle (create+100get+100set) | 23.3µs | 280.6µs | 🟢 12.0x faster |
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.5x slower |
| selector(fn) | 7ns | 62ns | 🟢 9.6x faster |
| set + read 10 selectors | 5.9µs | 24.2µs | 🟢 4.1x faster |
| set + read 100 selectors | 51.9µs | 256.1µs | 🟢 4.9x faster |
| set + read through 5 chained selectors | 5.2µs | 15.3µs | 🟢 2.9x faster |
| set 1000 atoms | 89.5µs | 1.05ms | 🟢 11.7x faster |
| get 1000 atoms | 7.3µs | 377.4µs | 🟢 52.0x faster |
| txn: 10 atoms × 10 selectors, set + read | 63.5µs | 291.3µs | 🟢 4.6x faster |
| txn: 10 atoms × 10 selectors, with subs | 117.6µs | 587.0µs | 🟢 5.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 613.1µs | 2.64ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, set + read | 760.1µs | 3.23ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, with subs | 1.27ms | 20.41ms | 🟢 16.1x faster |

#### Optimization targets

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 244ns | 399ns | 1.6x faster |
| selectorFamily(id) | 266ns | 396ns | 1.5x faster |
| createStore | 449ns | 5.9µs | 13.2x faster |
| sub + unsub | 370ns | 2.5µs | 6.6x faster |

#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 19ns |
| valdres get | 8ns |
| jotai get | 370ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 250ns |
| jotai set | 2.5µs |

> Last updated: 2026-04-06 — Jotai v2.19.0 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
