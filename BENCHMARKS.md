# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 53ns | 🟢 19.7x faster |
| store.get(atom) | 40ns | 361ns | 🟢 9.0x faster |
| set(atom, value) | 171ns | 2.1µs | 🟢 12.4x faster |
| set(atom, curr => curr+1) | 180ns | 2.7µs | 🟢 15.1x faster |
| set(atom) with 10 subs | 194ns | 3.5µs | 🟢 18.3x faster |
| atom lifecycle (create+100get+100set) | 15.9µs | 280.8µs | 🟢 17.6x faster |
| set 1000 atoms | 74.7µs | 1.17ms | 🟢 15.7x faster |
| get 1000 atoms | 6.9µs | 355.4µs | 🟢 51.5x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 57ns | 🟢 10.9x faster |
| set + read 10 selectors | 8.6µs | 26.9µs | 🟢 3.1x faster |
| set + read 100 selectors | 79.3µs | 321.2µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 7.6µs | 17.5µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 80.7µs | 389.7µs | 🟢 4.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 137.5µs | 723.6µs | 🟢 5.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 765.4µs | 4.41ms | 🟢 5.8x faster |
| txn: cross-atom 1000 selectors, set + read | 911.2µs | 4.63ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.39ms | 23.48ms | 🟢 16.9x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 11ns | 🔴 2.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 331ns | 479ns | 🟢 1.4x faster |
| selectorFamily(id) | 353ns | 475ns | 🟢 1.3x faster |
| createStore | 587ns | 6.7µs | 🟢 11.3x faster |
| sub + unsub | 471ns | 2.4µs | 🟢 5.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 349ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 194ns |
| jotai set | 2.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 25ns | 50ns | 🟢 2.0x faster |
| store.get(atom) | 12ns | 161ns | 🟢 13.9x faster |
| set(atom, value) | 281ns | 1.2µs | 🟢 4.4x faster |
| set(atom, curr => curr+1) | 306ns | 1.5µs | 🟢 5.0x faster |
| set(atom) with 10 subs | 319ns | 1.7µs | 🟢 5.4x faster |
| atom lifecycle (create+100get+100set) | 31.9µs | 141.0µs | 🟢 4.4x faster |
| set 1000 atoms | 90.2µs | 465.1µs | 🟢 5.2x faster |
| get 1000 atoms | 14.2µs | 208.2µs | 🟢 14.7x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 54ns | 🟢 1.2x faster |
| set + read 10 selectors | 8.6µs | 19.1µs | 🟢 2.2x faster |
| set + read 100 selectors | 77.9µs | 128.3µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 4.8µs | 9.6µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 79.8µs | 140.6µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 78.9µs | 239.5µs | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 849.5µs | 1.30ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.06ms | 1.81ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 994.4µs | 12.92ms | 🟢 13.0x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 26ns | 6ns | 🔴 4.2x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 162ns | 1.2µs | 🟢 7.7x faster |
| sub + unsub | 789ns | 2.2µs | 🟢 2.8x faster |
| atomFamily(id) | 419ns | 542ns | 🟢 1.3x faster |
| selectorFamily(id) | 209ns | 374ns | 🟢 1.8x faster |

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
| valdres set | 300ns |
| jotai set | 1.4µs |
