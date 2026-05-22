# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-22

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 8ns | 70ns | 🟢 9.3x faster |
| store.get(atom) | 25ns | 740ns | 🟢 30.0x faster |
| set(atom, value) | 196ns | 2.7µs | 🟢 12.6x faster |
| set(atom, curr => curr+1) | 397ns | 5.4µs | 🟢 14.2x faster |
| set(atom) with 10 subs | 486ns | 5.8µs | 🟢 12.4x faster |
| atom lifecycle (create+100get+100set) | 15.8µs | 272.1µs | 🟢 17.4x faster |
| set 1000 atoms | 80.5µs | 942.2µs | 🟢 11.8x faster |
| get 1000 atoms | 7.9µs | 330.9µs | 🟢 41.8x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 11ns | 83ns | 🟢 7.2x faster |
| set + read 10 selectors | 8.6µs | 25.9µs | 🟢 2.9x faster |
| set + read 100 selectors | 62.6µs | 229.8µs | 🟢 3.6x faster |
| set + read through 5 chained selectors | 5.1µs | 12.6µs | 🟢 2.5x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 70.5µs | 262.3µs | 🟢 3.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 129.5µs | 494.8µs | 🟢 4.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 809.4µs | 3.05ms | 🟢 3.6x faster |
| txn: cross-atom 1000 selectors, set + read | 834.8µs | 3.51ms | 🟢 4.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.51ms | 17.79ms | 🟢 13.1x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 31ns | 11ns | 🔴 2.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 307ns | 394ns | 🟢 1.3x faster |
| selectorFamily(id) | 311ns | 389ns | 🟢 1.4x faster |
| createStore | 513ns | 7.0µs | 🟢 13.7x faster |
| sub + unsub | 1.2µs | 3.5µs | 🟢 3.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 3ns |
| valdres get | 9ns |
| jotai get | 338ns |
| obj.value = n | 1ns |
| map.set(key, n) | 18ns |
| valdres set | 165ns |
| jotai set | 2.8µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 57ns | 🟢 2.3x faster |
| store.get(atom) | 13ns | 158ns | 🟢 11.3x faster |
| set(atom, value) | 254ns | 1.3µs | 🟢 5.1x faster |
| set(atom, curr => curr+1) | 254ns | 1.5µs | 🟢 6.0x faster |
| set(atom) with 10 subs | 441ns | 1.9µs | 🟢 4.3x faster |
| atom lifecycle (create+100get+100set) | 27.7µs | 139.0µs | 🟢 5.0x faster |
| set 1000 atoms | 72.0µs | 445.6µs | 🟢 6.2x faster |
| get 1000 atoms | 13.4µs | 184.8µs | 🟢 14.0x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 42ns | 62ns | 🟢 1.4x faster |
| set + read 10 selectors | 7.6µs | 15.8µs | 🟢 2.1x faster |
| set + read 100 selectors | 72.2µs | 142.8µs | 🟢 2.0x faster |
| set + read through 5 chained selectors | 4.0µs | 8.1µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 114.0µs | 234.6µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 97.1µs | 296.1µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 879.5µs | 1.49ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, set + read | 1.10ms | 2.10ms | 🟢 2.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.66ms | 13.86ms | 🟢 8.4x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 58ns | 13ns | 🔴 4.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 240ns | 757ns | 🟢 3.1x faster |
| sub + unsub | 772ns | 1.5µs | 🟢 2.0x faster |
| atomFamily(id) | 207ns | 286ns | 🟢 1.5x faster |
| selectorFamily(id) | 209ns | 289ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 9ns |
| valdres get | 27ns |
| jotai get | 183ns |
| obj.value = n | 1ns |
| map.set(key, n) | 5ns |
| valdres set | 245ns |
| jotai set | 1.4µs |
