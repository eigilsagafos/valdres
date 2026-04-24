# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 52ns | 🟢 21.6x faster |
| store.get(atom) | 40ns | 361ns | 🟢 9.0x faster |
| set(atom, value) | 171ns | 2.0µs | 🟢 11.9x faster |
| set(atom, curr => curr+1) | 180ns | 2.6µs | 🟢 14.5x faster |
| set(atom) with 10 subs | 194ns | 3.6µs | 🟢 18.5x faster |
| atom lifecycle (create+100get+100set) | 17.5µs | 276.3µs | 🟢 15.8x faster |
| set 1000 atoms | 74.9µs | 1.15ms | 🟢 15.4x faster |
| get 1000 atoms | 6.7µs | 512.5µs | 🟢 76.9x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 58ns | 🟢 10.9x faster |
| set + read 10 selectors | 8.3µs | 27.2µs | 🟢 3.3x faster |
| set + read 100 selectors | 77.2µs | 322.9µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 7.5µs | 17.6µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 79.2µs | 293.2µs | 🟢 3.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 139.1µs | 607.0µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 758.7µs | 3.24ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, set + read | 910.9µs | 4.62ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.41ms | 24.96ms | 🟢 17.7x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 47ns | 11ns | 🔴 4.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 340ns | 459ns | 🟢 1.4x faster |
| selectorFamily(id) | 336ns | 441ns | 🟢 1.3x faster |
| createStore | 611ns | 6.5µs | 🟢 10.7x faster |
| sub + unsub | 481ns | 2.5µs | 🟢 5.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 344ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 191ns |
| jotai set | 3.1µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 51ns | 🟢 2.1x faster |
| store.get(atom) | 12ns | 158ns | 🟢 13.6x faster |
| set(atom, value) | 281ns | 1.2µs | 🟢 4.3x faster |
| set(atom, curr => curr+1) | 306ns | 1.4µs | 🟢 4.6x faster |
| set(atom) with 10 subs | 318ns | 1.7µs | 🟢 5.3x faster |
| atom lifecycle (create+100get+100set) | 31.3µs | 141.1µs | 🟢 4.5x faster |
| set 1000 atoms | 89.7µs | 447.3µs | 🟢 5.0x faster |
| get 1000 atoms | 14.1µs | 206.1µs | 🟢 14.6x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 41ns | 56ns | 🟢 1.4x faster |
| set + read 10 selectors | 8.7µs | 19.3µs | 🟢 2.2x faster |
| set + read 100 selectors | 77.6µs | 126.7µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 4.8µs | 9.6µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 76.4µs | 139.9µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 76.9µs | 237.1µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 835.5µs | 1.29ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.03ms | 1.77ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.01ms | 12.52ms | 🟢 12.4x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 26ns | 6ns | 🔴 4.2x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 160ns | 1.2µs | 🟢 7.6x faster |
| sub + unsub | 798ns | 2.1µs | 🟢 2.6x faster |
| atomFamily(id) | 419ns | 485ns | 🟢 1.2x faster |
| selectorFamily(id) | 362ns | 353ns | 🟡 1.0x slower |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 200ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 284ns |
| jotai set | 1.3µs |
