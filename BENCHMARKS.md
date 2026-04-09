# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-09

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 52ns | 🟢 18.9x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 221ns | 2.1µs | 🟢 9.7x faster |
| set(atom, curr => curr+1) | 280ns | 2.7µs | 🟢 9.6x faster |
| set(atom) with 10 subs | 549ns | 3.7µs | 🟢 6.7x faster |
| atom lifecycle (create+100get+100set) | 29.8µs | 275.4µs | 🟢 9.2x faster |
| set 1000 atoms | 71.8µs | 1.21ms | 🟢 16.8x faster |
| get 1000 atoms | 6.7µs | 539.9µs | 🟢 80.7x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 57ns | 🟢 11.2x faster |
| set + read 10 selectors | 9.4µs | 31.1µs | 🟢 3.3x faster |
| set + read 100 selectors | 88.6µs | 336.8µs | 🟢 3.8x faster |
| set + read through 5 chained selectors | 8.5µs | 18.5µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 94.0µs | 305.9µs | 🟢 3.3x faster |
| txn: 10 atoms × 10 selectors, with subs | 121.3µs | 659.3µs | 🟢 5.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 794.3µs | 3.42ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, set + read | 943.9µs | 4.83ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.19ms | 25.36ms | 🟢 21.3x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 316ns | 450ns | 🟢 1.4x faster |
| selectorFamily(id) | 311ns | 434ns | 🟢 1.4x faster |
| createStore | 623ns | 6.4µs | 🟢 10.3x faster |
| sub + unsub | 491ns | 2.5µs | 🟢 5.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 17ns |
| valdres get | 9ns |
| jotai get | 371ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 427ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 50ns | 🟢 2.1x faster |
| store.get(atom) | 12ns | 157ns | 🟢 13.5x faster |
| set(atom, value) | 366ns | 1.2µs | 🟢 3.3x faster |
| set(atom, curr => curr+1) | 397ns | 1.4µs | 🟢 3.6x faster |
| set(atom) with 10 subs | 752ns | 1.7µs | 🟢 2.3x faster |
| atom lifecycle (create+100get+100set) | 42.5µs | 142.3µs | 🟢 3.3x faster |
| set 1000 atoms | 100.8µs | 449.3µs | 🟢 4.5x faster |
| get 1000 atoms | 14.1µs | 201.5µs | 🟢 14.3x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 53ns | 🟢 1.2x faster |
| set + read 10 selectors | 8.9µs | 19.7µs | 🟢 2.2x faster |
| set + read 100 selectors | 80.2µs | 127.2µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 5.0µs | 9.8µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 81.3µs | 137.3µs | 🟢 1.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 81.2µs | 237.5µs | 🟢 2.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 874.4µs | 1.31ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.08ms | 1.83ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.05ms | 12.47ms | 🟢 11.9x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 11ns | 7ns | 🟡 1.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 159ns | 1.2µs | 🟢 7.7x faster |
| sub + unsub | 758ns | 2.1µs | 🟢 2.8x faster |
| atomFamily(id) | 368ns | 471ns | 🟢 1.3x faster |
| selectorFamily(id) | 314ns | 388ns | 🟢 1.2x faster |

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
| valdres set | 375ns |
| jotai set | 1.3µs |
