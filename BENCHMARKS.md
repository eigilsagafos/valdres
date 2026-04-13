# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-13

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 53ns | 🟢 21.7x faster |
| store.get(atom) | 40ns | 380ns | 🟢 9.5x faster |
| set(atom, value) | 180ns | 2.1µs | 🟢 11.9x faster |
| set(atom, curr => curr+1) | 200ns | 2.7µs | 🟢 13.5x faster |
| set(atom) with 10 subs | 184ns | 3.7µs | 🟢 19.9x faster |
| atom lifecycle (create+100get+100set) | 15.2µs | 279.8µs | 🟢 18.4x faster |
| set 1000 atoms | 70.0µs | 1.16ms | 🟢 16.6x faster |
| get 1000 atoms | 7.2µs | 553.2µs | 🟢 76.6x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 63ns | 🟢 10.1x faster |
| set + read 10 selectors | 8.3µs | 30.4µs | 🟢 3.7x faster |
| set + read 100 selectors | 73.3µs | 333.8µs | 🟢 4.6x faster |
| set + read through 5 chained selectors | 7.5µs | 17.9µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 76.1µs | 305.4µs | 🟢 4.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 135.7µs | 601.4µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 744.9µs | 3.43ms | 🟢 4.6x faster |
| txn: cross-atom 1000 selectors, set + read | 904.7µs | 4.85ms | 🟢 5.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.42ms | 25.27ms | 🟢 17.8x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 55ns | 11ns | 🔴 4.9x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 358ns | 504ns | 🟢 1.4x faster |
| selectorFamily(id) | 362ns | 503ns | 🟢 1.4x faster |
| createStore | 664ns | 6.7µs | 🟢 10.1x faster |
| sub + unsub | 501ns | 2.4µs | 🟢 4.7x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 356ns |
| obj.value = n | 5ns |
| map.set(key, n) | 16ns |
| valdres set | 184ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 27ns | 49ns | 🟢 1.8x faster |
| store.get(atom) | 13ns | 160ns | 🟢 12.6x faster |
| set(atom, value) | 257ns | 1.2µs | 🟢 4.6x faster |
| set(atom, curr => curr+1) | 280ns | 1.5µs | 🟢 5.2x faster |
| set(atom) with 10 subs | 292ns | 1.7µs | 🟢 6.0x faster |
| atom lifecycle (create+100get+100set) | 29.5µs | 139.0µs | 🟢 4.7x faster |
| set 1000 atoms | 114.9µs | 420.3µs | 🟢 3.7x faster |
| get 1000 atoms | 13.8µs | 204.1µs | 🟢 14.8x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 44ns | 54ns | 🟢 1.2x faster |
| set + read 10 selectors | 7.9µs | 20.1µs | 🟢 2.5x faster |
| set + read 100 selectors | 69.3µs | 127.3µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.5µs | 9.9µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 73.3µs | 138.9µs | 🟢 1.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 72.4µs | 235.8µs | 🟢 3.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 789.0µs | 1.30ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 972.6µs | 1.83ms | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 944.0µs | 12.71ms | 🟢 13.5x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 23ns | 7ns | 🔴 3.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 157ns | 1.2µs | 🟢 7.6x faster |
| sub + unsub | 669ns | 2.0µs | 🟢 3.1x faster |
| atomFamily(id) | 457ns | 567ns | 🟢 1.2x faster |
| selectorFamily(id) | 264ns | 397ns | 🟢 1.5x faster |

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
| valdres set | 273ns |
| jotai set | 1.3µs |
