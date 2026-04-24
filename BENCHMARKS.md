# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 51ns | 🟢 21.8x faster |
| store.get(atom) | 40ns | 370ns | 🟢 9.3x faster |
| set(atom, value) | 171ns | 2.0µs | 🟢 11.9x faster |
| set(atom, curr => curr+1) | 180ns | 2.6µs | 🟢 14.4x faster |
| set(atom) with 10 subs | 190ns | 3.4µs | 🟢 17.6x faster |
| atom lifecycle (create+100get+100set) | 15.9µs | 268.0µs | 🟢 16.9x faster |
| set 1000 atoms | 75.7µs | 1.15ms | 🟢 15.2x faster |
| get 1000 atoms | 6.6µs | 516.3µs | 🟢 78.2x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 70ns | 🟢 14.5x faster |
| set + read 10 selectors | 8.2µs | 29.6µs | 🟢 3.6x faster |
| set + read 100 selectors | 78.7µs | 324.5µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 7.7µs | 17.6µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 81.8µs | 294.4µs | 🟢 3.6x faster |
| txn: 10 atoms × 10 selectors, with subs | 139.4µs | 610.7µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 759.3µs | 3.28ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, set + read | 920.1µs | 4.72ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.41ms | 24.41ms | 🟢 17.4x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 27ns | 11ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 285ns | 451ns | 🟢 1.6x faster |
| selectorFamily(id) | 294ns | 434ns | 🟢 1.5x faster |
| createStore | 613ns | 6.5µs | 🟢 10.6x faster |
| sub + unsub | 481ns | 2.4µs | 🟢 5.0x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 347ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 191ns |
| jotai set | 3.1µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 49ns | 🟢 2.0x faster |
| store.get(atom) | 12ns | 159ns | 🟢 13.7x faster |
| set(atom, value) | 278ns | 1.2µs | 🟢 4.4x faster |
| set(atom, curr => curr+1) | 298ns | 1.5µs | 🟢 5.0x faster |
| set(atom) with 10 subs | 338ns | 1.7µs | 🟢 5.0x faster |
| atom lifecycle (create+100get+100set) | 32.9µs | 141.2µs | 🟢 4.3x faster |
| set 1000 atoms | 88.0µs | 453.7µs | 🟢 5.2x faster |
| get 1000 atoms | 13.8µs | 210.3µs | 🟢 15.2x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 40ns | 53ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.5µs | 19.4µs | 🟢 2.3x faster |
| set + read 100 selectors | 75.9µs | 129.3µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 4.9µs | 9.8µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 75.9µs | 139.9µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 78.6µs | 239.5µs | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 845.9µs | 1.32ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 1.04ms | 1.82ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.00ms | 12.45ms | 🟢 12.4x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 25ns | 6ns | 🔴 4.1x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 161ns | 1.3µs | 🟢 7.8x faster |
| sub + unsub | 785ns | 2.1µs | 🟢 2.6x faster |
| atomFamily(id) | 391ns | 481ns | 🟢 1.2x faster |
| selectorFamily(id) | 250ns | 351ns | 🟢 1.4x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 199ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 279ns |
| jotai set | 1.3µs |
