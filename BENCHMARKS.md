# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-21

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 7ns | 70ns | 🟢 9.5x faster |
| store.get(atom) | 13ns | 353ns | 🟢 27.4x faster |
| set(atom, value) | 180ns | 2.7µs | 🟢 13.8x faster |
| set(atom, curr => curr+1) | 329ns | 5.3µs | 🟢 16.1x faster |
| set(atom) with 10 subs | 430ns | 6.0µs | 🟢 14.6x faster |
| atom lifecycle (create+100get+100set) | 16.0µs | 274.2µs | 🟢 17.1x faster |
| set 1000 atoms | 81.1µs | 900.8µs | 🟢 11.2x faster |
| get 1000 atoms | 8.3µs | 362.6µs | 🟢 43.9x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 9ns | 70ns | 🟢 7.9x faster |
| set + read 10 selectors | 8.1µs | 28.2µs | 🟢 3.4x faster |
| set + read 100 selectors | 58.9µs | 248.7µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 5.6µs | 13.0µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 63.5µs | 270.8µs | 🟢 4.3x faster |
| txn: 10 atoms × 10 selectors, with subs | 143.8µs | 544.0µs | 🟢 4.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 911.4µs | 3.83ms | 🟢 4.1x faster |
| txn: cross-atom 1000 selectors, set + read | 823.1µs | 3.78ms | 🟢 4.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.69ms | 20.38ms | 🟢 12.1x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 35ns | 13ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 351ns | 471ns | 🟢 1.4x faster |
| selectorFamily(id) | 295ns | 345ns | 🟢 1.3x faster |
| createStore | 269ns | 6.1µs | 🟢 22.9x faster |
| sub + unsub | 1.4µs | 4.0µs | 🟢 3.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 11ns |
| jotai get | 364ns |
| obj.value = n | 1ns |
| map.set(key, n) | 17ns |
| valdres set | 186ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 28ns | 54ns | 🟢 1.7x faster |
| store.get(atom) | 16ns | 159ns | 🟢 9.9x faster |
| set(atom, value) | 379ns | 1.2µs | 🟢 3.3x faster |
| set(atom, curr => curr+1) | 272ns | 1.5µs | 🟢 5.5x faster |
| set(atom) with 10 subs | 447ns | 1.7µs | 🟢 3.9x faster |
| atom lifecycle (create+100get+100set) | 30.5µs | 138.1µs | 🟢 4.6x faster |
| set 1000 atoms | 81.4µs | 448.0µs | 🟢 5.5x faster |
| get 1000 atoms | 14.4µs | 205.9µs | 🟢 14.3x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 46ns | 60ns | 🟢 1.3x faster |
| set + read 10 selectors | 7.3µs | 14.3µs | 🟢 2.0x faster |
| set + read 100 selectors | 76.6µs | 131.1µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 4.2µs | 7.3µs | 🟢 1.8x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 133.9µs | 311.0µs | 🟢 2.3x faster |
| txn: 10 atoms × 10 selectors, with subs | 88.6µs | 281.8µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 845.0µs | 1.43ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 1.05ms | 1.89ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.33ms | 12.90ms | 🟢 9.2x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 8ns | 🔴 3.3x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 178ns | 578ns | 🟢 3.3x faster |
| sub + unsub | 728ns | 1.4µs | 🟢 1.9x faster |
| atomFamily(id) | 154ns | 217ns | 🟢 1.4x faster |
| selectorFamily(id) | 161ns | 194ns | 🟢 1.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 10ns |
| valdres get | 18ns |
| jotai get | 203ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 252ns |
| jotai set | 1.4µs |
