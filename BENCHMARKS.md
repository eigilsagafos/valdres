# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 52ns | 🟢 21.7x faster |
| store.get(atom) | 40ns | 370ns | 🟢 9.3x faster |
| set(atom, value) | 180ns | 2.0µs | 🟢 11.3x faster |
| set(atom, curr => curr+1) | 151ns | 2.7µs | 🟢 17.6x faster |
| set(atom) with 10 subs | 192ns | 3.5µs | 🟢 18.4x faster |
| atom lifecycle (create+100get+100set) | 17.3µs | 271.1µs | 🟢 15.7x faster |
| set 1000 atoms | 74.8µs | 1.16ms | 🟢 15.5x faster |
| get 1000 atoms | 7.4µs | 526.2µs | 🟢 71.4x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 71ns | 🟢 14.7x faster |
| set + read 10 selectors | 8.3µs | 30.1µs | 🟢 3.6x faster |
| set + read 100 selectors | 76.5µs | 324.8µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 7.7µs | 18.0µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 80.9µs | 298.6µs | 🟢 3.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 138.1µs | 633.5µs | 🟢 4.6x faster |
| txn: 10 atoms × 100 selectors, set + read | 768.4µs | 3.31ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, set + read | 900.9µs | 4.67ms | 🟢 5.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.39ms | 24.37ms | 🟢 17.5x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 11ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 318ns | 466ns | 🟢 1.5x faster |
| selectorFamily(id) | 338ns | 456ns | 🟢 1.4x faster |
| createStore | 621ns | 6.6µs | 🟢 10.7x faster |
| sub + unsub | 471ns | 2.5µs | 🟢 5.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 351ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 189ns |
| jotai set | 3.1µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 25ns | 54ns | 🟢 2.2x faster |
| store.get(atom) | 12ns | 157ns | 🟢 13.5x faster |
| set(atom, value) | 273ns | 1.2µs | 🟢 4.5x faster |
| set(atom, curr => curr+1) | 265ns | 1.4µs | 🟢 5.4x faster |
| set(atom) with 10 subs | 297ns | 1.7µs | 🟢 5.7x faster |
| atom lifecycle (create+100get+100set) | 31.8µs | 136.8µs | 🟢 4.3x faster |
| set 1000 atoms | 78.9µs | 437.1µs | 🟢 5.5x faster |
| get 1000 atoms | 13.8µs | 208.2µs | 🟢 15.1x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 46ns | 59ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.6µs | 18.9µs | 🟢 2.2x faster |
| set + read 100 selectors | 77.9µs | 124.4µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 5.0µs | 9.6µs | 🟢 1.9x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 77.0µs | 136.0µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 76.1µs | 238.3µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 838.5µs | 1.27ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.07ms | 1.83ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 994.2µs | 12.24ms | 🟢 12.3x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 25ns | 7ns | 🔴 3.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 159ns | 1.2µs | 🟢 7.6x faster |
| sub + unsub | 766ns | 2.0µs | 🟢 2.7x faster |
| atomFamily(id) | 390ns | 497ns | 🟢 1.3x faster |
| selectorFamily(id) | 230ns | 351ns | 🟢 1.5x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 199ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 268ns |
| jotai set | 1.3µs |
