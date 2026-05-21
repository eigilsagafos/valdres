# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-21

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 54ns | 🟢 19.6x faster |
| store.get(atom) | 40ns | 361ns | 🟢 9.0x faster |
| set(atom, value) | 170ns | 2.1µs | 🟢 12.1x faster |
| set(atom, curr => curr+1) | 153ns | 2.7µs | 🟢 17.5x faster |
| set(atom) with 10 subs | 196ns | 3.8µs | 🟢 19.2x faster |
| atom lifecycle (create+100get+100set) | 16.3µs | 273.8µs | 🟢 16.8x faster |
| set 1000 atoms | 74.1µs | 1.18ms | 🟢 15.9x faster |
| get 1000 atoms | 6.7µs | 553.6µs | 🟢 82.1x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 58ns | 🟢 11.2x faster |
| set + read 10 selectors | 8.9µs | 30.5µs | 🟢 3.4x faster |
| set + read 100 selectors | 80.9µs | 333.2µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 7.8µs | 18.1µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 86.0µs | 300.0µs | 🟢 3.5x faster |
| txn: 10 atoms × 10 selectors, with subs | 111.1µs | 634.8µs | 🟢 5.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 771.8µs | 3.42ms | 🟢 4.4x faster |
| txn: cross-atom 1000 selectors, set + read | 886.6µs | 4.80ms | 🟢 5.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.15ms | 25.91ms | 🟢 22.6x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 11ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 343ns | 493ns | 🟢 1.4x faster |
| selectorFamily(id) | 347ns | 476ns | 🟢 1.4x faster |
| createStore | 655ns | 6.8µs | 🟢 10.4x faster |
| sub + unsub | 501ns | 2.4µs | 🟢 4.8x faster |

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
| jotai set | 3.2µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 50ns | 🟢 2.1x faster |
| store.get(atom) | 13ns | 159ns | 🟢 12.5x faster |
| set(atom, value) | 270ns | 1.2µs | 🟢 4.6x faster |
| set(atom, curr => curr+1) | 275ns | 1.5µs | 🟢 5.3x faster |
| set(atom) with 10 subs | 315ns | 1.8µs | 🟢 5.6x faster |
| atom lifecycle (create+100get+100set) | 32.3µs | 143.7µs | 🟢 4.4x faster |
| set 1000 atoms | 87.9µs | 459.0µs | 🟢 5.2x faster |
| get 1000 atoms | 14.9µs | 209.3µs | 🟢 14.1x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 50ns | 53ns | 🟢 1.1x faster |
| set + read 10 selectors | 9.2µs | 20.5µs | 🟢 2.2x faster |
| set + read 100 selectors | 78.4µs | 128.2µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 5.0µs | 10.1µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 78.7µs | 140.7µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 77.8µs | 239.8µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 850.3µs | 1.29ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.05ms | 1.84ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 985.6µs | 13.05ms | 🟢 13.2x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 26ns | 7ns | 🔴 3.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 171ns | 1.5µs | 🟢 8.8x faster |
| sub + unsub | 811ns | 2.2µs | 🟢 2.7x faster |
| atomFamily(id) | 479ns | 554ns | 🟢 1.2x faster |
| selectorFamily(id) | 305ns | 412ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 13ns |
| jotai get | 199ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 272ns |
| jotai set | 1.4µs |
