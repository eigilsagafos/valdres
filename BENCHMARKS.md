# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-09

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 51ns | 🟢 20.1x faster |
| store.get(atom) | 40ns | 391ns | 🟢 9.8x faster |
| set(atom, value) | 230ns | 2.1µs | 🟢 9.3x faster |
| set(atom, curr => curr+1) | 271ns | 2.8µs | 🟢 10.4x faster |
| set(atom) with 10 subs | 551ns | 3.8µs | 🟢 6.8x faster |
| atom lifecycle (create+100get+100set) | 25.0µs | 282.8µs | 🟢 11.3x faster |
| set 1000 atoms | 72.3µs | 1.22ms | 🟢 16.8x faster |
| get 1000 atoms | 6.6µs | 377.7µs | 🟢 57.1x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 73ns | 🟢 13.9x faster |
| set + read 10 selectors | 8.5µs | 28.1µs | 🟢 3.3x faster |
| set + read 100 selectors | 77.4µs | 336.4µs | 🟢 4.3x faster |
| set + read through 5 chained selectors | 7.5µs | 18.3µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 79.9µs | 406.7µs | 🟢 5.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 137.9µs | 741.3µs | 🟢 5.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 753.6µs | 4.51ms | 🟢 6.0x faster |
| txn: cross-atom 1000 selectors, set + read | 896.2µs | 4.80ms | 🟢 5.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.40ms | 25.37ms | 🟢 18.2x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 317ns | 442ns | 🟢 1.4x faster |
| selectorFamily(id) | 328ns | 431ns | 🟢 1.3x faster |
| createStore | 645ns | 6.5µs | 🟢 10.1x faster |
| sub + unsub | 481ns | 2.5µs | 🟢 5.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 17ns |
| valdres get | 8ns |
| jotai get | 369ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 438ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 26ns | 48ns | 🟢 1.9x faster |
| store.get(atom) | 12ns | 159ns | 🟢 13.7x faster |
| set(atom, value) | 388ns | 1.2µs | 🟢 3.1x faster |
| set(atom, curr => curr+1) | 397ns | 1.5µs | 🟢 3.8x faster |
| set(atom) with 10 subs | 752ns | 1.7µs | 🟢 2.3x faster |
| atom lifecycle (create+100get+100set) | 42.5µs | 142.4µs | 🟢 3.4x faster |
| set 1000 atoms | 90.4µs | 439.6µs | 🟢 4.9x faster |
| get 1000 atoms | 13.9µs | 207.1µs | 🟢 14.9x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 42ns | 56ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.6µs | 18.9µs | 🟢 2.2x faster |
| set + read 100 selectors | 77.0µs | 125.6µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 4.7µs | 9.7µs | 🟢 2.1x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 77.7µs | 139.7µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 79.7µs | 238.4µs | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 833.5µs | 1.31ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 1.06ms | 1.78ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.00ms | 12.38ms | 🟢 12.4x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 11ns | 7ns | 🟡 1.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 161ns | 1.4µs | 🟢 8.5x faster |
| sub + unsub | 774ns | 2.1µs | 🟢 2.7x faster |
| atomFamily(id) | 395ns | 518ns | 🟢 1.3x faster |
| selectorFamily(id) | 300ns | 366ns | 🟢 1.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 198ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 387ns |
| jotai set | 1.4µs |
