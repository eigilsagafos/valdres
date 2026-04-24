# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 54ns | 🟢 20.4x faster |
| store.get(atom) | 40ns | 370ns | 🟢 9.3x faster |
| set(atom, value) | 171ns | 2.1µs | 🟢 12.1x faster |
| set(atom, curr => curr+1) | 210ns | 2.6µs | 🟢 12.5x faster |
| set(atom) with 10 subs | 191ns | 3.5µs | 🟢 18.5x faster |
| atom lifecycle (create+100get+100set) | 16.0µs | 273.1µs | 🟢 17.1x faster |
| set 1000 atoms | 74.5µs | 1.15ms | 🟢 15.5x faster |
| get 1000 atoms | 6.5µs | 526.5µs | 🟢 80.4x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 59ns | 🟢 11.1x faster |
| set + read 10 selectors | 8.5µs | 28.9µs | 🟢 3.4x faster |
| set + read 100 selectors | 77.8µs | 314.9µs | 🟢 4.0x faster |
| set + read through 5 chained selectors | 7.3µs | 17.4µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 79.3µs | 289.5µs | 🟢 3.6x faster |
| txn: 10 atoms × 10 selectors, with subs | 136.6µs | 605.6µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 742.4µs | 3.20ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, set + read | 893.4µs | 4.59ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.40ms | 25.25ms | 🟢 18.0x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 11ns | 🔴 2.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 337ns | 486ns | 🟢 1.4x faster |
| selectorFamily(id) | 348ns | 475ns | 🟢 1.4x faster |
| createStore | 578ns | 6.5µs | 🟢 11.2x faster |
| sub + unsub | 461ns | 2.4µs | 🟢 5.2x faster |

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
| valdres set | 191ns |
| jotai set | 3.1µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 49ns | 🟢 2.0x faster |
| store.get(atom) | 12ns | 160ns | 🟢 13.7x faster |
| set(atom, value) | 277ns | 1.2µs | 🟢 4.5x faster |
| set(atom, curr => curr+1) | 296ns | 1.5µs | 🟢 5.0x faster |
| set(atom) with 10 subs | 334ns | 1.7µs | 🟢 5.1x faster |
| atom lifecycle (create+100get+100set) | 33.0µs | 141.9µs | 🟢 4.3x faster |
| set 1000 atoms | 91.5µs | 454.4µs | 🟢 5.0x faster |
| get 1000 atoms | 14.4µs | 204.9µs | 🟢 14.2x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 53ns | 🟢 1.2x faster |
| set + read 10 selectors | 8.9µs | 19.8µs | 🟢 2.2x faster |
| set + read 100 selectors | 77.8µs | 126.5µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 5.0µs | 10.0µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 78.0µs | 138.2µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 77.3µs | 239.3µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 851.8µs | 1.31ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.04ms | 1.81ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 988.1µs | 13.07ms | 🟢 13.2x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 26ns | 7ns | 🔴 3.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 160ns | 1.4µs | 🟢 8.6x faster |
| sub + unsub | 870ns | 2.2µs | 🟢 2.5x faster |
| atomFamily(id) | 487ns | 544ns | 🟢 1.1x faster |
| selectorFamily(id) | 425ns | 381ns | 🟡 1.1x slower |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 201ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 282ns |
| jotai set | 1.3µs |
