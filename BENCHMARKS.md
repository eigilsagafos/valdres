# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-21

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 53ns | 🟢 20.8x faster |
| store.get(atom) | 40ns | 361ns | 🟢 9.0x faster |
| set(atom, value) | 171ns | 2.1µs | 🟢 12.0x faster |
| set(atom, curr => curr+1) | 153ns | 2.6µs | 🟢 17.0x faster |
| set(atom) with 10 subs | 194ns | 3.6µs | 🟢 18.7x faster |
| atom lifecycle (create+100get+100set) | 15.9µs | 276.5µs | 🟢 17.3x faster |
| set 1000 atoms | 74.6µs | 1.18ms | 🟢 15.8x faster |
| get 1000 atoms | 4.2µs | 545.9µs | 🟢 128.5x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 62ns | 🟢 11.8x faster |
| set + read 10 selectors | 9.0µs | 27.8µs | 🟢 3.1x faster |
| set + read 100 selectors | 79.8µs | 331.7µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 7.7µs | 18.3µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 82.2µs | 305.6µs | 🟢 3.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 143.0µs | 630.7µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 802.6µs | 3.40ms | 🟢 4.2x faster |
| txn: cross-atom 1000 selectors, set + read | 952.9µs | 4.84ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.48ms | 25.58ms | 🟢 17.3x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 11ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 351ns | 494ns | 🟢 1.4x faster |
| selectorFamily(id) | 354ns | 481ns | 🟢 1.4x faster |
| createStore | 684ns | 6.9µs | 🟢 10.0x faster |
| sub + unsub | 561ns | 2.5µs | 🟢 4.4x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 12ns |
| jotai get | 345ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 171ns |
| jotai set | 2.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 49ns | 🟢 2.0x faster |
| store.get(atom) | 13ns | 164ns | 🟢 13.0x faster |
| set(atom, value) | 276ns | 1.2µs | 🟢 4.5x faster |
| set(atom, curr => curr+1) | 262ns | 1.5µs | 🟢 5.7x faster |
| set(atom) with 10 subs | 322ns | 1.7µs | 🟢 5.2x faster |
| atom lifecycle (create+100get+100set) | 32.1µs | 140.9µs | 🟢 4.4x faster |
| set 1000 atoms | 87.5µs | 453.7µs | 🟢 5.2x faster |
| get 1000 atoms | 14.8µs | 207.2µs | 🟢 14.0x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 42ns | 56ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.9µs | 19.1µs | 🟢 2.1x faster |
| set + read 100 selectors | 77.3µs | 127.0µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 4.8µs | 9.6µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 79.8µs | 142.9µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 78.2µs | 240.0µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 876.5µs | 1.30ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.08ms | 1.79ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.05ms | 13.06ms | 🟢 12.4x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 26ns | 6ns | 🔴 4.1x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 162ns | 1.3µs | 🟢 7.8x faster |
| sub + unsub | 771ns | 2.1µs | 🟢 2.8x faster |
| atomFamily(id) | 452ns | 536ns | 🟢 1.2x faster |
| selectorFamily(id) | 400ns | 386ns | 🟡 1.0x slower |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 5ns |
| valdres get | 13ns |
| jotai get | 198ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 277ns |
| jotai set | 1.4µs |
