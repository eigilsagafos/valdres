# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-09

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 6ns | 67ns | 🟢 10.7x faster |
| store.get(atom) | 26ns | 365ns | 🟢 14.0x faster |
| set(atom, value) | 157ns | 2.2µs | 🟢 13.7x faster |
| set(atom, curr => curr+1) | 199ns | 2.6µs | 🟢 13.3x faster |
| set(atom) with 10 subs | 195ns | 4.0µs | 🟢 20.7x faster |
| atom lifecycle (create+100get+100set) | 16.0µs | 284.3µs | 🟢 17.8x faster |
| set 1000 atoms | 70.3µs | 1.19ms | 🟢 16.9x faster |
| get 1000 atoms | 6.6µs | 519.4µs | 🟢 79.2x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 10ns | 85ns | 🟢 8.8x faster |
| set + read 10 selectors | 8.2µs | 27.9µs | 🟢 3.4x faster |
| set + read 100 selectors | 73.9µs | 309.2µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 7.5µs | 16.8µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 85.2µs | 317.4µs | 🟢 3.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 138.0µs | 653.8µs | 🟢 4.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 781.1µs | 3.57ms | 🟢 4.6x faster |
| txn: cross-atom 1000 selectors, set + read | 936.8µs | 5.08ms | 🟢 5.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.49ms | 29.69ms | 🟢 20.0x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 44ns | 11ns | 🔴 3.9x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 318ns | 443ns | 🟢 1.4x faster |
| selectorFamily(id) | 324ns | 410ns | 🟢 1.3x faster |
| createStore | 676ns | 7.7µs | 🟢 11.4x faster |
| sub + unsub | 490ns | 2.7µs | 🟢 5.5x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 335ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 183ns |
| jotai set | 3.0µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 61ns | 🟢 2.5x faster |
| store.get(atom) | 11ns | 160ns | 🟢 14.9x faster |
| set(atom, value) | 260ns | 1.4µs | 🟢 5.5x faster |
| set(atom, curr => curr+1) | 276ns | 1.7µs | 🟢 6.1x faster |
| set(atom) with 10 subs | 296ns | 2.1µs | 🟢 7.2x faster |
| atom lifecycle (create+100get+100set) | 30.1µs | 155.9µs | 🟢 5.2x faster |
| set 1000 atoms | 91.2µs | 447.4µs | 🟢 4.9x faster |
| get 1000 atoms | 13.2µs | 186.2µs | 🟢 14.1x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 41ns | 70ns | 🟢 1.7x faster |
| set + read 10 selectors | 8.8µs | 24.1µs | 🟢 2.7x faster |
| set + read 100 selectors | 74.2µs | 150.8µs | 🟢 2.0x faster |
| set + read through 5 chained selectors | 5.1µs | 11.6µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 82.7µs | 165.8µs | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 76.7µs | 280.3µs | 🟢 3.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 812.2µs | 1.61ms | 🟢 2.0x faster |
| txn: cross-atom 1000 selectors, set + read | 1.03ms | 2.24ms | 🟢 2.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.14ms | 13.94ms | 🟢 12.2x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 18ns | 6ns | 🔴 3.2x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 403ns | 2.1µs | 🟢 5.2x faster |
| sub + unsub | 838ns | 2.7µs | 🟢 3.2x faster |
| atomFamily(id) | 469ns | 575ns | 🟢 1.2x faster |
| selectorFamily(id) | 423ns | 519ns | 🟢 1.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 11ns |
| jotai get | 191ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 253ns |
| jotai set | 1.5µs |
