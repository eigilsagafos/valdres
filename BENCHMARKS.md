# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 51ns | 🟢 21.9x faster |
| store.get(atom) | 40ns | 361ns | 🟢 9.0x faster |
| set(atom, value) | 171ns | 2.2µs | 🟢 12.6x faster |
| set(atom, curr => curr+1) | 179ns | 2.7µs | 🟢 14.9x faster |
| set(atom) with 10 subs | 194ns | 3.5µs | 🟢 18.3x faster |
| atom lifecycle (create+100get+100set) | 17.1µs | 275.3µs | 🟢 16.1x faster |
| set 1000 atoms | 76.0µs | 1.18ms | 🟢 15.6x faster |
| get 1000 atoms | 4.0µs | 356.4µs | 🟢 89.6x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 60ns | 🟢 12.7x faster |
| set + read 10 selectors | 8.5µs | 30.2µs | 🟢 3.6x faster |
| set + read 100 selectors | 81.0µs | 328.2µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 7.7µs | 18.2µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 82.0µs | 401.8µs | 🟢 4.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 141.6µs | 725.9µs | 🟢 5.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 783.2µs | 4.47ms | 🟢 5.7x faster |
| txn: cross-atom 1000 selectors, set + read | 934.3µs | 4.80ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.42ms | 24.11ms | 🟢 17.0x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 27ns | 11ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 299ns | 465ns | 🟢 1.6x faster |
| selectorFamily(id) | 297ns | 439ns | 🟢 1.5x faster |
| createStore | 623ns | 6.5µs | 🟢 10.5x faster |
| sub + unsub | 501ns | 2.5µs | 🟢 5.0x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 7ns |
| jotai get | 343ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 191ns |
| jotai set | 3.2µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 49ns | 🟢 2.1x faster |
| store.get(atom) | 12ns | 159ns | 🟢 13.6x faster |
| set(atom, value) | 286ns | 1.2µs | 🟢 4.3x faster |
| set(atom, curr => curr+1) | 341ns | 1.5µs | 🟢 4.4x faster |
| set(atom) with 10 subs | 309ns | 1.7µs | 🟢 5.6x faster |
| atom lifecycle (create+100get+100set) | 30.6µs | 142.6µs | 🟢 4.7x faster |
| set 1000 atoms | 91.0µs | 444.9µs | 🟢 4.9x faster |
| get 1000 atoms | 13.9µs | 204.0µs | 🟢 14.7x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 41ns | 55ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.8µs | 19.9µs | 🟢 2.3x faster |
| set + read 100 selectors | 80.0µs | 129.7µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 4.9µs | 9.8µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 78.3µs | 141.3µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 78.2µs | 241.8µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 856.0µs | 1.32ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.07ms | 1.85ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.02ms | 13.32ms | 🟢 13.0x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 6ns | 🔴 4.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 156ns | 1.2µs | 🟢 7.6x faster |
| sub + unsub | 786ns | 2.1µs | 🟢 2.7x faster |
| atomFamily(id) | 283ns | 375ns | 🟢 1.3x faster |
| selectorFamily(id) | 283ns | 366ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 200ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 286ns |
| jotai set | 1.4µs |
