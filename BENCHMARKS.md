# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-22

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 8ns | 80ns | 🟢 9.4x faster |
| store.get(atom) | 25ns | 708ns | 🟢 27.6x faster |
| set(atom, value) | 304ns | 4.7µs | 🟢 15.4x faster |
| set(atom, curr => curr+1) | 359ns | 5.7µs | 🟢 15.7x faster |
| set(atom) with 10 subs | 435ns | 5.9µs | 🟢 13.8x faster |
| atom lifecycle (create+100get+100set) | 16.6µs | 278.7µs | 🟢 16.9x faster |
| set 1000 atoms | 103.7µs | 922.7µs | 🟢 9.0x faster |
| get 1000 atoms | 8.5µs | 368.9µs | 🟢 43.4x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 9ns | 71ns | 🟢 8.3x faster |
| set + read 10 selectors | 7.0µs | 40.4µs | 🟢 5.6x faster |
| set + read 100 selectors | 55.2µs | 207.1µs | 🟢 3.8x faster |
| set + read through 5 chained selectors | 7.2µs | 14.9µs | 🟢 2.1x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 68.7µs | 239.5µs | 🟢 3.6x faster |
| txn: 10 atoms × 10 selectors, with subs | 196.6µs | 742.6µs | 🟢 4.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 947.8µs | 3.00ms | 🟢 3.2x faster |
| txn: cross-atom 1000 selectors, set + read | 769.1µs | 3.09ms | 🟢 4.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.50ms | 19.25ms | 🟢 14.7x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 32ns | 12ns | 🔴 2.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 332ns | 449ns | 🟢 1.4x faster |
| selectorFamily(id) | 334ns | 447ns | 🟢 1.4x faster |
| createStore | 258ns | 6.1µs | 🟢 23.7x faster |
| sub + unsub | 1.3µs | 4.0µs | 🟢 3.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 11ns |
| jotai get | 361ns |
| obj.value = n | 1ns |
| map.set(key, n) | 17ns |
| valdres set | 185ns |
| jotai set | 3.2µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 28ns | 52ns | 🟢 1.7x faster |
| store.get(atom) | 23ns | 164ns | 🟢 7.2x faster |
| set(atom, value) | 406ns | 1.2µs | 🟢 3.1x faster |
| set(atom, curr => curr+1) | 273ns | 1.5µs | 🟢 5.4x faster |
| set(atom) with 10 subs | 458ns | 1.7µs | 🟢 3.8x faster |
| atom lifecycle (create+100get+100set) | 29.6µs | 141.7µs | 🟢 4.8x faster |
| set 1000 atoms | 80.8µs | 436.6µs | 🟢 5.4x faster |
| get 1000 atoms | 14.3µs | 205.1µs | 🟢 14.4x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 51ns | 58ns | 🟢 1.2x faster |
| set + read 10 selectors | 7.3µs | 14.5µs | 🟢 2.0x faster |
| set + read 100 selectors | 74.2µs | 132.6µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.2µs | 7.4µs | 🟢 1.8x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 137.4µs | 312.8µs | 🟢 2.3x faster |
| txn: 10 atoms × 10 selectors, with subs | 93.3µs | 283.8µs | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 889.2µs | 1.40ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 1.10ms | 1.87ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.27ms | 12.96ms | 🟢 9.6x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 87ns | 29ns | 🔴 4.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 179ns | 552ns | 🟢 3.1x faster |
| sub + unsub | 731ns | 1.4µs | 🟢 1.9x faster |
| atomFamily(id) | 254ns | 250ns | 🟢 1.1x faster |
| selectorFamily(id) | 156ns | 191ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 24ns |
| valdres get | 18ns |
| jotai get | 202ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 264ns |
| jotai set | 1.3µs |
