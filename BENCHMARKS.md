# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-21

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 5ns | 61ns | 🟢 11.9x faster |
| store.get(atom) | 13ns | 341ns | 🟢 26.6x faster |
| set(atom, value) | 179ns | 2.7µs | 🟢 15.2x faster |
| set(atom, curr => curr+1) | 345ns | 5.9µs | 🟢 16.7x faster |
| set(atom) with 10 subs | 268ns | 3.3µs | 🟢 12.6x faster |
| atom lifecycle (create+100get+100set) | 16.2µs | 266.7µs | 🟢 16.6x faster |
| set 1000 atoms | 111.4µs | 923.2µs | 🟢 8.3x faster |
| get 1000 atoms | 8.9µs | 420.9µs | 🟢 53.5x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 63ns | 🟢 9.1x faster |
| set + read 10 selectors | 6.6µs | 24.0µs | 🟢 3.7x faster |
| set + read 100 selectors | 57.6µs | 241.3µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 5.9µs | 13.1µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 69.7µs | 258.8µs | 🟢 3.6x faster |
| txn: 10 atoms × 10 selectors, with subs | 120.0µs | 521.1µs | 🟢 4.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 832.0µs | 3.35ms | 🟢 4.0x faster |
| txn: cross-atom 1000 selectors, set + read | 799.6µs | 3.55ms | 🟢 4.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.59ms | 18.54ms | 🟢 12.5x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 11ns | 🔴 2.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 312ns | 429ns | 🟢 1.4x faster |
| selectorFamily(id) | 289ns | 390ns | 🟢 1.4x faster |
| createStore | 229ns | 6.0µs | 🟢 26.1x faster |
| sub + unsub | 1.1µs | 3.9µs | 🟢 4.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 11ns |
| jotai get | 352ns |
| obj.value = n | 1ns |
| map.set(key, n) | 17ns |
| valdres set | 189ns |
| jotai set | 3.1µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 27ns | 57ns | 🟢 1.9x faster |
| store.get(atom) | 15ns | 161ns | 🟢 10.8x faster |
| set(atom, value) | 434ns | 1.3µs | 🟢 3.0x faster |
| set(atom, curr => curr+1) | 288ns | 1.5µs | 🟢 5.2x faster |
| set(atom) with 10 subs | 494ns | 1.8µs | 🟢 3.6x faster |
| atom lifecycle (create+100get+100set) | 32.4µs | 151.7µs | 🟢 4.7x faster |
| set 1000 atoms | 80.7µs | 482.7µs | 🟢 6.0x faster |
| get 1000 atoms | 16.3µs | 206.5µs | 🟢 12.9x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 45ns | 62ns | 🟢 1.2x faster |
| set + read 10 selectors | 8.2µs | 14.2µs | 🟢 1.7x faster |
| set + read 100 selectors | 80.2µs | 132.0µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 4.4µs | 7.2µs | 🟢 1.6x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 174.3µs | 286.8µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 104.5µs | 285.0µs | 🟢 2.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 937.1µs | 1.38ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.14ms | 1.86ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, with subs | 1.29ms | 12.85ms | 🟢 8.2x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 7ns | 🔴 4.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 160ns | 574ns | 🟢 3.6x faster |
| sub + unsub | 793ns | 1.4µs | 🟢 1.8x faster |
| atomFamily(id) | 169ns | 220ns | 🟢 1.3x faster |
| selectorFamily(id) | 181ns | 235ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 9ns |
| valdres get | 17ns |
| jotai get | 198ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 266ns |
| jotai set | 1.4µs |
