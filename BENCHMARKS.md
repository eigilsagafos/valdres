# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 51ns | 🟢 22.0x faster |
| store.get(atom) | 40ns | 370ns | 🟢 9.3x faster |
| set(atom, value) | 170ns | 2.1µs | 🟢 12.1x faster |
| set(atom, curr => curr+1) | 152ns | 2.7µs | 🟢 17.5x faster |
| set(atom) with 10 subs | 196ns | 3.5µs | 🟢 17.7x faster |
| atom lifecycle (create+100get+100set) | 15.7µs | 269.4µs | 🟢 17.2x faster |
| set 1000 atoms | 74.7µs | 1.16ms | 🟢 15.5x faster |
| get 1000 atoms | 6.8µs | 364.7µs | 🟢 53.7x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 71ns | 🟢 14.4x faster |
| set + read 10 selectors | 8.5µs | 30.8µs | 🟢 3.6x faster |
| set + read 100 selectors | 78.3µs | 330.5µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 7.6µs | 17.9µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 83.5µs | 400.2µs | 🟢 4.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 143.4µs | 748.6µs | 🟢 5.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 769.2µs | 4.50ms | 🟢 5.9x faster |
| txn: cross-atom 1000 selectors, set + read | 909.0µs | 4.71ms | 🟢 5.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.48ms | 24.27ms | 🟢 16.4x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 11ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 276ns | 436ns | 🟢 1.6x faster |
| selectorFamily(id) | 290ns | 428ns | 🟢 1.5x faster |
| createStore | 624ns | 6.6µs | 🟢 10.6x faster |
| sub + unsub | 501ns | 2.5µs | 🟢 4.9x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 351ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 193ns |
| jotai set | 3.2µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 25ns | 50ns | 🟢 2.0x faster |
| store.get(atom) | 12ns | 162ns | 🟢 13.9x faster |
| set(atom, value) | 274ns | 1.3µs | 🟢 4.7x faster |
| set(atom, curr => curr+1) | 267ns | 1.5µs | 🟢 5.7x faster |
| set(atom) with 10 subs | 310ns | 1.8µs | 🟢 5.7x faster |
| atom lifecycle (create+100get+100set) | 31.9µs | 152.4µs | 🟢 4.8x faster |
| set 1000 atoms | 81.0µs | 438.8µs | 🟢 5.4x faster |
| get 1000 atoms | 14.1µs | 209.5µs | 🟢 14.8x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 56ns | 🟢 1.3x faster |
| set + read 10 selectors | 7.7µs | 18.9µs | 🟢 2.5x faster |
| set + read 100 selectors | 75.8µs | 128.5µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 4.3µs | 9.7µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 80.6µs | 140.0µs | 🟢 1.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 78.3µs | 241.6µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 834.7µs | 1.35ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 1.05ms | 1.84ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.01ms | 12.18ms | 🟢 12.1x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 26ns | 7ns | 🔴 3.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 157ns | 1.3µs | 🟢 8.6x faster |
| sub + unsub | 790ns | 2.0µs | 🟢 2.6x faster |
| atomFamily(id) | 354ns | 445ns | 🟢 1.3x faster |
| selectorFamily(id) | 212ns | 339ns | 🟢 1.6x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 201ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 257ns |
| jotai set | 1.4µs |
