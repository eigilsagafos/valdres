# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-10

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 50ns | 🟢 21.4x faster |
| store.get(atom) | 40ns | 371ns | 🟢 9.3x faster |
| set(atom, value) | 170ns | 2.1µs | 🟢 12.1x faster |
| set(atom, curr => curr+1) | 201ns | 2.6µs | 🟢 13.1x faster |
| set(atom) with 10 subs | 188ns | 3.7µs | 🟢 19.5x faster |
| atom lifecycle (create+100get+100set) | 15.7µs | 272.1µs | 🟢 17.3x faster |
| set 1000 atoms | 73.4µs | 1.16ms | 🟢 15.9x faster |
| get 1000 atoms | 6.7µs | 520.9µs | 🟢 78.3x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 72ns | 🟢 14.8x faster |
| set + read 10 selectors | 8.4µs | 27.6µs | 🟢 3.3x faster |
| set + read 100 selectors | 77.3µs | 323.1µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 7.5µs | 17.8µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 82.5µs | 296.8µs | 🟢 3.6x faster |
| txn: 10 atoms × 10 selectors, with subs | 135.6µs | 611.7µs | 🟢 4.5x faster |
| txn: 10 atoms × 100 selectors, set + read | 754.4µs | 3.27ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, set + read | 921.2µs | 4.66ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.40ms | 20.60ms | 🟢 14.7x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 47ns | 11ns | 🔴 4.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 302ns | 443ns | 🟢 1.5x faster |
| selectorFamily(id) | 307ns | 440ns | 🟢 1.4x faster |
| createStore | 606ns | 6.3µs | 🟢 10.4x faster |
| sub + unsub | 470ns | 2.5µs | 🟢 5.3x faster |

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
| valdres set | 196ns |
| jotai set | 3.1µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 49ns | 🟢 2.0x faster |
| store.get(atom) | 12ns | 158ns | 🟢 13.6x faster |
| set(atom, value) | 287ns | 1.2µs | 🟢 4.2x faster |
| set(atom, curr => curr+1) | 319ns | 1.5µs | 🟢 4.6x faster |
| set(atom) with 10 subs | 322ns | 1.7µs | 🟢 5.2x faster |
| atom lifecycle (create+100get+100set) | 31.4µs | 139.2µs | 🟢 4.4x faster |
| set 1000 atoms | 98.4µs | 457.5µs | 🟢 4.6x faster |
| get 1000 atoms | 14.5µs | 206.7µs | 🟢 14.3x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 40ns | 54ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.6µs | 19.0µs | 🟢 2.2x faster |
| set + read 100 selectors | 77.7µs | 126.8µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 4.9µs | 9.7µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 81.5µs | 138.0µs | 🟢 1.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 76.1µs | 239.1µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 835.9µs | 1.33ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 1.04ms | 1.80ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 973.1µs | 12.16ms | 🟢 12.5x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 11ns | 6ns | 🟡 1.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 158ns | 1.2µs | 🟢 7.5x faster |
| sub + unsub | 773ns | 2.0µs | 🟢 2.6x faster |
| atomFamily(id) | 360ns | 465ns | 🟢 1.3x faster |
| selectorFamily(id) | 255ns | 360ns | 🟢 1.4x faster |

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
| valdres set | 286ns |
| jotai set | 1.3µs |
