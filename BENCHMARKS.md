# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 52ns | 🟢 20.6x faster |
| store.get(atom) | 40ns | 421ns | 🟢 10.5x faster |
| set(atom, value) | 171ns | 2.0µs | 🟢 11.9x faster |
| set(atom, curr => curr+1) | 179ns | 2.6µs | 🟢 14.5x faster |
| set(atom) with 10 subs | 193ns | 3.4µs | 🟢 17.9x faster |
| atom lifecycle (create+100get+100set) | 15.9µs | 269.8µs | 🟢 17.0x faster |
| set 1000 atoms | 75.2µs | 1.16ms | 🟢 15.4x faster |
| get 1000 atoms | 4.0µs | 354.5µs | 🟢 88.0x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 57ns | 🟢 11.4x faster |
| set + read 10 selectors | 8.8µs | 30.5µs | 🟢 3.5x faster |
| set + read 100 selectors | 79.7µs | 324.2µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 7.5µs | 18.1µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 81.8µs | 396.8µs | 🟢 4.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 141.0µs | 720.9µs | 🟢 5.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 781.2µs | 4.42ms | 🟢 5.7x faster |
| txn: cross-atom 1000 selectors, set + read | 924.2µs | 4.68ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.42ms | 24.49ms | 🟢 17.2x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 11ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 305ns | 461ns | 🟢 1.5x faster |
| selectorFamily(id) | 313ns | 441ns | 🟢 1.4x faster |
| createStore | 622ns | 6.5µs | 🟢 10.5x faster |
| sub + unsub | 491ns | 2.4µs | 🟢 5.0x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 345ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 192ns |
| jotai set | 3.1µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 50ns | 🟢 2.1x faster |
| store.get(atom) | 12ns | 158ns | 🟢 13.5x faster |
| set(atom, value) | 277ns | 1.3µs | 🟢 4.5x faster |
| set(atom, curr => curr+1) | 301ns | 1.5µs | 🟢 4.9x faster |
| set(atom) with 10 subs | 312ns | 1.7µs | 🟢 5.5x faster |
| atom lifecycle (create+100get+100set) | 31.3µs | 139.8µs | 🟢 4.5x faster |
| set 1000 atoms | 91.2µs | 457.6µs | 🟢 5.0x faster |
| get 1000 atoms | 13.8µs | 207.9µs | 🟢 15.0x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 42ns | 54ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.9µs | 19.4µs | 🟢 2.2x faster |
| set + read 100 selectors | 77.6µs | 127.7µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 4.9µs | 9.7µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 79.5µs | 141.3µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 78.6µs | 237.9µs | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 850.1µs | 1.29ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.05ms | 1.80ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 975.7µs | 12.44ms | 🟢 12.8x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 25ns | 7ns | 🔴 3.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 157ns | 1.3µs | 🟢 8.2x faster |
| sub + unsub | 786ns | 2.1µs | 🟢 2.6x faster |
| atomFamily(id) | 414ns | 491ns | 🟢 1.2x faster |
| selectorFamily(id) | 277ns | 365ns | 🟢 1.3x faster |

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
| valdres set | 287ns |
| jotai set | 1.3µs |
