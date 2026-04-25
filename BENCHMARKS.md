# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-25

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 58ns | 🟢 23.4x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 180ns | 2.1µs | 🟢 11.5x faster |
| set(atom, curr => curr+1) | 149ns | 2.6µs | 🟢 17.7x faster |
| set(atom) with 10 subs | 188ns | 3.8µs | 🟢 20.4x faster |
| atom lifecycle (create+100get+100set) | 17.3µs | 281.0µs | 🟢 16.2x faster |
| set 1000 atoms | 72.5µs | 1.18ms | 🟢 16.3x faster |
| get 1000 atoms | 7.2µs | 561.8µs | 🟢 77.6x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 64ns | 🟢 10.3x faster |
| set + read 10 selectors | 7.0µs | 31.7µs | 🟢 4.5x faster |
| set + read 100 selectors | 77.5µs | 352.3µs | 🟢 4.5x faster |
| set + read through 5 chained selectors | 8.0µs | 18.2µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 83.5µs | 318.1µs | 🟢 3.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 111.7µs | 635.5µs | 🟢 5.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 747.1µs | 3.59ms | 🟢 4.8x faster |
| txn: cross-atom 1000 selectors, set + read | 916.7µs | 5.09ms | 🟢 5.6x faster |
| txn: cross-atom 1000 selectors, with subs | 1.16ms | 26.85ms | 🟢 23.1x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 55ns | 11ns | 🔴 4.9x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 389ns | 525ns | 🟢 1.3x faster |
| selectorFamily(id) | 400ns | 521ns | 🟢 1.3x faster |
| createStore | 664ns | 6.9µs | 🟢 10.4x faster |
| sub + unsub | 500ns | 2.4µs | 🟢 4.8x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 358ns |
| obj.value = n | 5ns |
| map.set(key, n) | 17ns |
| valdres set | 188ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 26ns | 48ns | 🟢 1.9x faster |
| store.get(atom) | 13ns | 163ns | 🟢 12.8x faster |
| set(atom, value) | 247ns | 1.2µs | 🟢 4.9x faster |
| set(atom, curr => curr+1) | 252ns | 1.5µs | 🟢 5.8x faster |
| set(atom) with 10 subs | 283ns | 1.7µs | 🟢 6.1x faster |
| atom lifecycle (create+100get+100set) | 30.0µs | 136.9µs | 🟢 4.6x faster |
| set 1000 atoms | 79.6µs | 425.0µs | 🟢 5.3x faster |
| get 1000 atoms | 13.7µs | 205.5µs | 🟢 15.0x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 53ns | 🟢 1.2x faster |
| set + read 10 selectors | 8.0µs | 20.1µs | 🟢 2.5x faster |
| set + read 100 selectors | 70.4µs | 127.2µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.6µs | 10.1µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 68.5µs | 136.0µs | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 74.1µs | 236.3µs | 🟢 3.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 785.2µs | 1.35ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 987.2µs | 1.80ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 939.6µs | 13.11ms | 🟢 14.0x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 23ns | 7ns | 🔴 3.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 159ns | 1.4µs | 🟢 9.0x faster |
| sub + unsub | 703ns | 2.2µs | 🟢 3.2x faster |
| atomFamily(id) | 554ns | 659ns | 🟢 1.2x faster |
| selectorFamily(id) | 492ns | 432ns | 🟡 1.1x slower |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 13ns |
| jotai get | 202ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 253ns |
| jotai set | 1.3µs |
