# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-11

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 51ns | 🟢 20.8x faster |
| store.get(atom) | 40ns | 371ns | 🟢 9.3x faster |
| set(atom, value) | 170ns | 2.1µs | 🟢 12.1x faster |
| set(atom, curr => curr+1) | 201ns | 2.7µs | 🟢 13.3x faster |
| set(atom) with 10 subs | 191ns | 3.6µs | 🟢 19.1x faster |
| atom lifecycle (create+100get+100set) | 15.6µs | 270.6µs | 🟢 17.4x faster |
| set 1000 atoms | 73.7µs | 1.18ms | 🟢 16.0x faster |
| get 1000 atoms | 6.7µs | 361.4µs | 🟢 53.7x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 57ns | 🟢 11.6x faster |
| set + read 10 selectors | 8.3µs | 28.4µs | 🟢 3.4x faster |
| set + read 100 selectors | 76.0µs | 322.6µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 7.4µs | 17.6µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 81.8µs | 401.4µs | 🟢 4.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 135.9µs | 715.0µs | 🟢 5.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 768.0µs | 4.47ms | 🟢 5.8x faster |
| txn: cross-atom 1000 selectors, set + read | 925.2µs | 4.68ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.40ms | 24.59ms | 🟢 17.5x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 47ns | 11ns | 🔴 4.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 294ns | 440ns | 🟢 1.5x faster |
| selectorFamily(id) | 323ns | 440ns | 🟢 1.4x faster |
| createStore | 600ns | 6.4µs | 🟢 10.7x faster |
| sub + unsub | 471ns | 2.5µs | 🟢 5.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 348ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 192ns |
| jotai set | 3.1µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 25ns | 49ns | 🟢 2.0x faster |
| store.get(atom) | 12ns | 158ns | 🟢 13.6x faster |
| set(atom, value) | 285ns | 1.2µs | 🟢 4.3x faster |
| set(atom, curr => curr+1) | 298ns | 1.5µs | 🟢 4.9x faster |
| set(atom) with 10 subs | 322ns | 1.7µs | 🟢 5.2x faster |
| atom lifecycle (create+100get+100set) | 32.2µs | 140.2µs | 🟢 4.4x faster |
| set 1000 atoms | 94.4µs | 442.2µs | 🟢 4.7x faster |
| get 1000 atoms | 14.7µs | 209.8µs | 🟢 14.3x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 41ns | 53ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.7µs | 18.9µs | 🟢 2.2x faster |
| set + read 100 selectors | 79.2µs | 125.6µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 4.7µs | 9.5µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 79.9µs | 139.2µs | 🟢 1.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 78.5µs | 239.0µs | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 840.3µs | 1.28ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.05ms | 1.77ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.01ms | 12.51ms | 🟢 12.4x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 25ns | 7ns | 🔴 3.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 156ns | 1.3µs | 🟢 8.2x faster |
| sub + unsub | 745ns | 2.1µs | 🟢 2.8x faster |
| atomFamily(id) | 387ns | 457ns | 🟢 1.2x faster |
| selectorFamily(id) | 209ns | 349ns | 🟢 1.7x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 199ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 295ns |
| jotai set | 1.3µs |
