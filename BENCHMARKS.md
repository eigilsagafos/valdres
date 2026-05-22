# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-22

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 8ns | 89ns | 🟢 10.7x faster |
| store.get(atom) | 12ns | 322ns | 🟢 26.0x faster |
| set(atom, value) | 343ns | 4.1µs | 🟢 12.5x faster |
| set(atom, curr => curr+1) | 406ns | 5.7µs | 🟢 13.7x faster |
| set(atom) with 10 subs | 301ns | 4.3µs | 🟢 13.3x faster |
| atom lifecycle (create+100get+100set) | 16.4µs | 277.0µs | 🟢 16.8x faster |
| set 1000 atoms | 96.8µs | 948.9µs | 🟢 9.8x faster |
| get 1000 atoms | 8.1µs | 337.7µs | 🟢 41.8x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 10ns | 81ns | 🟢 7.3x faster |
| set + read 10 selectors | 11.3µs | 40.0µs | 🟢 3.6x faster |
| set + read 100 selectors | 58.8µs | 226.0µs | 🟢 3.8x faster |
| set + read through 5 chained selectors | 5.3µs | 12.5µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 69.2µs | 256.0µs | 🟢 3.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 107.5µs | 461.9µs | 🟢 4.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 795.7µs | 2.93ms | 🟢 3.5x faster |
| txn: cross-atom 1000 selectors, set + read | 790.8µs | 3.39ms | 🟢 4.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.69ms | 17.90ms | 🟢 12.2x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 31ns | 12ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 303ns | 403ns | 🟢 1.4x faster |
| selectorFamily(id) | 281ns | 391ns | 🟢 1.4x faster |
| createStore | 293ns | 6.6µs | 🟢 22.3x faster |
| sub + unsub | 1.0µs | 3.3µs | 🟢 3.5x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 3ns |
| valdres get | 9ns |
| jotai get | 341ns |
| obj.value = n | 1ns |
| map.set(key, n) | 16ns |
| valdres set | 171ns |
| jotai set | 2.8µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 58ns | 🟢 2.3x faster |
| store.get(atom) | 19ns | 159ns | 🟢 8.8x faster |
| set(atom, value) | 258ns | 1.4µs | 🟢 5.2x faster |
| set(atom, curr => curr+1) | 257ns | 1.6µs | 🟢 6.1x faster |
| set(atom) with 10 subs | 445ns | 2.0µs | 🟢 4.4x faster |
| atom lifecycle (create+100get+100set) | 27.7µs | 155.0µs | 🟢 5.6x faster |
| set 1000 atoms | 75.5µs | 508.8µs | 🟢 6.3x faster |
| get 1000 atoms | 13.2µs | 182.3µs | 🟢 14.0x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 45ns | 62ns | 🟢 1.3x faster |
| set + read 10 selectors | 7.7µs | 15.4µs | 🟢 2.0x faster |
| set + read 100 selectors | 74.8µs | 137.1µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.1µs | 7.6µs | 🟢 1.8x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 113.2µs | 233.6µs | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 99.9µs | 293.2µs | 🟢 2.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 887.8µs | 1.48ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 1.08ms | 1.96ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.46ms | 12.53ms | 🟢 8.5x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 63ns | 13ns | 🔴 4.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 271ns | 809ns | 🟢 3.0x faster |
| sub + unsub | 897ns | 1.6µs | 🟢 1.8x faster |
| atomFamily(id) | 270ns | 336ns | 🟢 1.4x faster |
| selectorFamily(id) | 267ns | 337ns | 🟢 1.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 21ns |
| valdres get | 15ns |
| jotai get | 186ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 242ns |
| jotai set | 1.5µs |
