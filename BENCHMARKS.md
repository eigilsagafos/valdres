# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 52ns | 🟢 20.1x faster |
| store.get(atom) | 40ns | 361ns | 🟢 9.0x faster |
| set(atom, value) | 170ns | 2.1µs | 🟢 12.4x faster |
| set(atom, curr => curr+1) | 180ns | 2.7µs | 🟢 15.0x faster |
| set(atom) with 10 subs | 193ns | 3.6µs | 🟢 18.5x faster |
| atom lifecycle (create+100get+100set) | 16.0µs | 273.2µs | 🟢 17.1x faster |
| set 1000 atoms | 74.2µs | 1.17ms | 🟢 15.8x faster |
| get 1000 atoms | 6.9µs | 527.7µs | 🟢 77.0x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 59ns | 🟢 10.8x faster |
| set + read 10 selectors | 8.8µs | 27.9µs | 🟢 3.2x faster |
| set + read 100 selectors | 79.7µs | 333.3µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 8.1µs | 18.2µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 84.4µs | 303.6µs | 🟢 3.6x faster |
| txn: 10 atoms × 10 selectors, with subs | 112.0µs | 635.1µs | 🟢 5.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 749.4µs | 3.38ms | 🟢 4.5x faster |
| txn: cross-atom 1000 selectors, set + read | 893.8µs | 4.79ms | 🟢 5.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.11ms | 25.96ms | 🟢 23.3x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 304ns | 461ns | 🟢 1.5x faster |
| selectorFamily(id) | 344ns | 436ns | 🟢 1.3x faster |
| createStore | 660ns | 6.7µs | 🟢 10.2x faster |
| sub + unsub | 501ns | 2.6µs | 🟢 5.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 346ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 191ns |
| jotai set | 3.2µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 49ns | 🟢 2.0x faster |
| store.get(atom) | 12ns | 159ns | 🟢 13.7x faster |
| set(atom, value) | 285ns | 1.3µs | 🟢 4.5x faster |
| set(atom, curr => curr+1) | 305ns | 1.5µs | 🟢 5.0x faster |
| set(atom) with 10 subs | 311ns | 1.8µs | 🟢 5.7x faster |
| atom lifecycle (create+100get+100set) | 31.8µs | 145.7µs | 🟢 4.6x faster |
| set 1000 atoms | 96.3µs | 461.4µs | 🟢 4.8x faster |
| get 1000 atoms | 14.2µs | 207.7µs | 🟢 14.7x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 41ns | 55ns | 🟢 1.4x faster |
| set + read 10 selectors | 9.0µs | 20.7µs | 🟢 2.3x faster |
| set + read 100 selectors | 77.6µs | 132.9µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 5.1µs | 10.4µs | 🟢 2.1x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 77.0µs | 142.8µs | 🟢 1.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 81.4µs | 245.2µs | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 852.3µs | 1.39ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 1.04ms | 1.93ms | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 1.05ms | 13.65ms | 🟢 13.0x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 26ns | 7ns | 🔴 3.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 167ns | 1.4µs | 🟢 8.2x faster |
| sub + unsub | 782ns | 2.2µs | 🟢 2.8x faster |
| atomFamily(id) | 433ns | 528ns | 🟢 1.2x faster |
| selectorFamily(id) | 298ns | 392ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 197ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 282ns |
| jotai set | 1.4µs |
