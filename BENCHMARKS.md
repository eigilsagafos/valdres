# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-27

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 5ns | 66ns | 🟢 14.4x faster |
| store.get(atom) | 27ns | 343ns | 🟢 12.7x faster |
| set(atom, value) | 163ns | 2.1µs | 🟢 13.0x faster |
| set(atom, curr => curr+1) | 164ns | 2.7µs | 🟢 16.5x faster |
| set(atom) with 10 subs | 190ns | 3.9µs | 🟢 20.7x faster |
| atom lifecycle (create+100get+100set) | 16.7µs | 279.6µs | 🟢 16.7x faster |
| set 1000 atoms | 71.9µs | 1.13ms | 🟢 15.7x faster |
| get 1000 atoms | 4.2µs | 349.2µs | 🟢 82.3x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 9ns | 88ns | 🟢 10.2x faster |
| set + read 10 selectors | 8.2µs | 27.2µs | 🟢 3.3x faster |
| set + read 100 selectors | 74.4µs | 263.5µs | 🟢 3.5x faster |
| set + read through 5 chained selectors | 7.0µs | 14.8µs | 🟢 2.1x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 76.7µs | 376.7µs | 🟢 4.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 128.0µs | 553.0µs | 🟢 4.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 737.3µs | 3.17ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, set + read | 879.5µs | 4.55ms | 🟢 5.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.41ms | 25.22ms | 🟢 17.9x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 44ns | 11ns | 🔴 3.9x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 303ns | 429ns | 🟢 1.4x faster |
| selectorFamily(id) | 328ns | 418ns | 🟢 1.3x faster |
| createStore | 558ns | 7.3µs | 🟢 13.0x faster |
| sub + unsub | 483ns | 2.5µs | 🟢 5.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 15ns |
| valdres get | 11ns |
| jotai get | 331ns |
| obj.value = n | 3ns |
| map.set(key, n) | 16ns |
| valdres set | 159ns |
| jotai set | 3.0µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 23ns | 55ns | 🟢 2.4x faster |
| store.get(atom) | 11ns | 160ns | 🟢 14.1x faster |
| set(atom, value) | 238ns | 1.4µs | 🟢 5.7x faster |
| set(atom, curr => curr+1) | 237ns | 1.5µs | 🟢 6.5x faster |
| set(atom) with 10 subs | 270ns | 1.8µs | 🟢 6.8x faster |
| atom lifecycle (create+100get+100set) | 28.5µs | 143.5µs | 🟢 5.0x faster |
| set 1000 atoms | 73.3µs | 431.1µs | 🟢 5.9x faster |
| get 1000 atoms | 13.5µs | 182.0µs | 🟢 13.5x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 41ns | 61ns | 🟢 1.5x faster |
| set + read 10 selectors | 8.5µs | 20.9µs | 🟢 2.5x faster |
| set + read 100 selectors | 71.4µs | 134.1µs | 🟢 1.9x faster |
| set + read through 5 chained selectors | 4.7µs | 10.6µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 73.8µs | 158.9µs | 🟢 2.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 73.2µs | 258.8µs | 🟢 3.5x faster |
| txn: 10 atoms × 100 selectors, set + read | 793.2µs | 1.45ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, set + read | 965.1µs | 1.96ms | 🟢 2.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.03ms | 12.99ms | 🟢 12.7x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 19ns | 5ns | 🔴 3.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 267ns | 1.7µs | 🟢 6.2x faster |
| sub + unsub | 838ns | 2.3µs | 🟢 2.8x faster |
| atomFamily(id) | 397ns | 488ns | 🟢 1.2x faster |
| selectorFamily(id) | 280ns | 422ns | 🟢 1.5x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 11ns |
| jotai get | 191ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 236ns |
| jotai set | 1.5µs |
