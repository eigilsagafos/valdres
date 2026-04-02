# Valdres

```bash
bun install
```

## Benchmarks

<!-- BENCH:START -->
### Performance vs Jotai

| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 36ns | 🟢 13.0x faster |
| store.get(atom) | 8ns | 31ns | 🟢 4.0x faster |
| set(atom, same) | 17ns | 111ns | 🟢 6.7x faster |
| set(atom, curr => curr+1) | 292ns | 582ns | 🟢 2.0x faster |
| atomFamily(id) | 328ns | 268ns | 🟡 1.2x slower |
| set + read 10 selectors | 4.1µs | 4.0µs | 🟡 1.0x slower |
| set + read 100 selectors | 35.9µs | 33.7µs | 🟡 1.1x slower |
| set + read through 5 chained selectors | 2.9µs | 3.0µs | 🟢 1.0x faster |
| createStore | 422ns | 127ns | 🔴 3.3x slower |
| set 1000 atoms | 56.2µs | 122.9µs | 🟢 2.2x faster |
| get 1000 atoms | 5.3µs | 46.0µs | 🟢 8.7x faster |
| sub + unsub | 149ns | 483ns | 🟢 3.2x faster |
#### Baseline (raw JS)

| Operation | Time |
|:----------|-----:|
| obj.value | 2ns |
| map.get(key) | 10ns |
| valdres get | 7ns |
| jotai get | 28ns |
| obj.value = n | 2ns |
| map.set(key, n) | 11ns |
| valdres set | 276ns |
| jotai set | 550ns |


> Last updated: 2026-04-02 — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
<!-- BENCH:END -->
