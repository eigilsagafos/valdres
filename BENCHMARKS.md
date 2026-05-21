# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-21

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 7ns | 57ns | 🟢 8.8x faster |
| store.get(atom) | 13ns | 399ns | 🟢 31.0x faster |
| set(atom, value) | 345ns | 5.8µs | 🟢 15.8x faster |
| set(atom, curr => curr+1) | 327ns | 5.6µs | 🟢 16.6x faster |
| set(atom) with 10 subs | 488ns | 6.3µs | 🟢 13.2x faster |
| atom lifecycle (create+100get+100set) | 17.7µs | 285.1µs | 🟢 16.0x faster |
| set 1000 atoms | 105.3µs | 943.5µs | 🟢 9.0x faster |
| get 1000 atoms | 9.8µs | 435.6µs | 🟢 51.7x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 8ns | 66ns | 🟢 8.2x faster |
| set + read 10 selectors | 7.1µs | 24.8µs | 🟢 3.6x faster |
| set + read 100 selectors | 68.4µs | 245.4µs | 🟢 3.7x faster |
| set + read through 5 chained selectors | 5.9µs | 13.2µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 72.1µs | 271.5µs | 🟢 3.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 130.1µs | 542.1µs | 🟢 4.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 834.0µs | 3.47ms | 🟢 4.1x faster |
| txn: cross-atom 1000 selectors, set + read | 838.2µs | 3.62ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, with subs | 1.50ms | 18.87ms | 🟢 12.4x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 11ns | 🔴 2.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 422ns | 620ns | 🟢 1.4x faster |
| selectorFamily(id) | 343ns | 448ns | 🟢 1.3x faster |
| createStore | 248ns | 6.0µs | 🟢 24.4x faster |
| sub + unsub | 1.1µs | 4.1µs | 🟢 3.9x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 9ns |
| jotai get | 350ns |
| obj.value = n | 1ns |
| map.set(key, n) | 19ns |
| valdres set | 191ns |
| jotai set | 3.1µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 35ns | 63ns | 🟢 1.9x faster |
| store.get(atom) | 24ns | 164ns | 🟢 6.9x faster |
| set(atom, value) | 425ns | 1.3µs | 🟢 3.0x faster |
| set(atom, curr => curr+1) | 278ns | 1.5µs | 🟢 5.4x faster |
| set(atom) with 10 subs | 482ns | 1.8µs | 🟢 3.7x faster |
| atom lifecycle (create+100get+100set) | 31.5µs | 144.6µs | 🟢 4.6x faster |
| set 1000 atoms | 79.8µs | 473.6µs | 🟢 5.9x faster |
| get 1000 atoms | 16.4µs | 209.3µs | 🟢 13.2x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 69ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.4µs | 14.8µs | 🟢 1.8x faster |
| set + read 100 selectors | 82.3µs | 135.2µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 4.7µs | 7.5µs | 🟢 1.6x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 142.9µs | 305.8µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 101.1µs | 283.9µs | 🟢 2.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 947.3µs | 1.44ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.14ms | 1.91ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.47ms | 13.30ms | 🟢 9.0x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 69ns | 31ns | 🔴 3.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 161ns | 574ns | 🟢 3.6x faster |
| sub + unsub | 854ns | 1.5µs | 🟢 1.7x faster |
| atomFamily(id) | 147ns | 217ns | 🟢 1.5x faster |
| selectorFamily(id) | 115ns | 175ns | 🟢 1.5x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 9ns |
| valdres get | 17ns |
| jotai get | 199ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 273ns |
| jotai set | 1.5µs |
