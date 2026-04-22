# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-22

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 52ns | 🟢 22.1x faster |
| store.get(atom) | 40ns | 361ns | 🟢 9.0x faster |
| set(atom, value) | 171ns | 2.0µs | 🟢 11.8x faster |
| set(atom, curr => curr+1) | 182ns | 2.6µs | 🟢 14.2x faster |
| set(atom) with 10 subs | 193ns | 3.4µs | 🟢 17.6x faster |
| atom lifecycle (create+100get+100set) | 17.4µs | 270.4µs | 🟢 15.6x faster |
| set 1000 atoms | 74.1µs | 1.18ms | 🟢 15.9x faster |
| get 1000 atoms | 6.6µs | 359.9µs | 🟢 54.4x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 73ns | 🟢 14.8x faster |
| set + read 10 selectors | 9.0µs | 28.1µs | 🟢 3.1x faster |
| set + read 100 selectors | 83.1µs | 340.4µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 8.2µs | 18.6µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 89.1µs | 407.5µs | 🟢 4.6x faster |
| txn: 10 atoms × 10 selectors, with subs | 117.6µs | 748.4µs | 🟢 6.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 767.6µs | 4.57ms | 🟢 6.0x faster |
| txn: cross-atom 1000 selectors, set + read | 932.1µs | 4.95ms | 🟢 5.3x faster |
| txn: cross-atom 1000 selectors, with subs | 1.16ms | 25.65ms | 🟢 22.2x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 50ns | 11ns | 🔴 4.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 316ns | 486ns | 🟢 1.5x faster |
| selectorFamily(id) | 343ns | 481ns | 🟢 1.4x faster |
| createStore | 684ns | 6.9µs | 🟢 10.0x faster |
| sub + unsub | 521ns | 2.5µs | 🟢 4.7x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 353ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 198ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 25ns | 49ns | 🟢 2.0x faster |
| store.get(atom) | 12ns | 159ns | 🟢 13.7x faster |
| set(atom, value) | 290ns | 1.3µs | 🟢 4.4x faster |
| set(atom, curr => curr+1) | 305ns | 1.5µs | 🟢 4.8x faster |
| set(atom) with 10 subs | 319ns | 1.7µs | 🟢 5.4x faster |
| atom lifecycle (create+100get+100set) | 31.4µs | 139.9µs | 🟢 4.5x faster |
| set 1000 atoms | 89.3µs | 445.2µs | 🟢 5.0x faster |
| get 1000 atoms | 14.0µs | 205.3µs | 🟢 14.7x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 40ns | 54ns | 🟢 1.4x faster |
| set + read 10 selectors | 8.8µs | 19.2µs | 🟢 2.2x faster |
| set + read 100 selectors | 79.8µs | 129.3µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 4.8µs | 9.9µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 79.2µs | 141.6µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 78.9µs | 243.5µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 846.7µs | 1.30ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.04ms | 1.85ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.02ms | 12.62ms | 🟢 12.3x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 26ns | 6ns | 🔴 4.2x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 161ns | 1.2µs | 🟢 7.6x faster |
| sub + unsub | 784ns | 2.1µs | 🟢 2.6x faster |
| atomFamily(id) | 395ns | 476ns | 🟢 1.2x faster |
| selectorFamily(id) | 240ns | 351ns | 🟢 1.5x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 200ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 282ns |
| jotai set | 1.3µs |
