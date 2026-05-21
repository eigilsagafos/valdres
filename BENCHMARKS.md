# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-21

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 9ns | 76ns | 🟢 7.3x faster |
| store.get(atom) | 13ns | 341ns | 🟢 27.0x faster |
| set(atom, value) | 328ns | 4.5µs | 🟢 14.0x faster |
| set(atom, curr => curr+1) | 371ns | 5.3µs | 🟢 15.1x faster |
| set(atom) with 10 subs | 390ns | 6.0µs | 🟢 15.6x faster |
| atom lifecycle (create+100get+100set) | 16.5µs | 271.9µs | 🟢 16.4x faster |
| set 1000 atoms | 109.0µs | 967.1µs | 🟢 8.8x faster |
| get 1000 atoms | 9.0µs | 357.1µs | 🟢 39.7x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 7ns | 69ns | 🟢 10.8x faster |
| set + read 10 selectors | 8.8µs | 40.3µs | 🟢 4.4x faster |
| set + read 100 selectors | 63.6µs | 204.6µs | 🟢 3.3x faster |
| set + read through 5 chained selectors | 7.9µs | 15.5µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 73.8µs | 280.7µs | 🟢 3.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 136.5µs | 597.9µs | 🟢 4.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 925.2µs | 2.75ms | 🟢 3.0x faster |
| txn: cross-atom 1000 selectors, set + read | 843.7µs | 3.06ms | 🟢 3.6x faster |
| txn: cross-atom 1000 selectors, with subs | 1.10ms | 18.46ms | 🟢 16.7x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 27ns | 12ns | 🔴 2.3x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 323ns | 426ns | 🟢 1.4x faster |
| selectorFamily(id) | 284ns | 383ns | 🟢 1.3x faster |
| createStore | 246ns | 5.9µs | 🟢 24.5x faster |
| sub + unsub | 1.3µs | 3.8µs | 🟢 3.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 12ns |
| jotai get | 350ns |
| obj.value = n | 1ns |
| map.set(key, n) | 17ns |
| valdres set | 192ns |
| jotai set | 3.0µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 27ns | 53ns | 🟢 1.9x faster |
| store.get(atom) | 24ns | 164ns | 🟢 6.9x faster |
| set(atom, value) | 427ns | 1.3µs | 🟢 3.0x faster |
| set(atom, curr => curr+1) | 287ns | 1.5µs | 🟢 5.2x faster |
| set(atom) with 10 subs | 501ns | 1.7µs | 🟢 3.5x faster |
| atom lifecycle (create+100get+100set) | 32.3µs | 145.6µs | 🟢 4.5x faster |
| set 1000 atoms | 89.3µs | 466.9µs | 🟢 5.2x faster |
| get 1000 atoms | 15.8µs | 205.4µs | 🟢 13.4x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 42ns | 62ns | 🟢 1.4x faster |
| set + read 10 selectors | 8.2µs | 14.0µs | 🟢 1.7x faster |
| set + read 100 selectors | 81.8µs | 132.1µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 4.3µs | 7.0µs | 🟢 1.6x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 138.2µs | 289.1µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 94.8µs | 268.4µs | 🟢 2.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 892.7µs | 1.36ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.09ms | 1.75ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, with subs | 1.10ms | 11.97ms | 🟢 9.8x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 60ns | 31ns | 🟡 1.9x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 164ns | 539ns | 🟢 3.3x faster |
| sub + unsub | 797ns | 1.4µs | 🟢 1.8x faster |
| atomFamily(id) | 164ns | 240ns | 🟢 1.4x faster |
| selectorFamily(id) | 117ns | 169ns | 🟢 1.4x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 9ns |
| valdres get | 17ns |
| jotai get | 199ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 279ns |
| jotai set | 1.4µs |
