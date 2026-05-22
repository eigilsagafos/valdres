# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-22

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 13ns | 81ns | 🟢 6.8x faster |
| store.get(atom) | 13ns | 353ns | 🟢 27.4x faster |
| set(atom, value) | 312ns | 4.2µs | 🟢 13.6x faster |
| set(atom, curr => curr+1) | 331ns | 5.2µs | 🟢 16.5x faster |
| set(atom) with 10 subs | 423ns | 6.1µs | 🟢 14.2x faster |
| atom lifecycle (create+100get+100set) | 29.3µs | 499.2µs | 🟢 17.2x faster |
| set 1000 atoms | 103.1µs | 924.1µs | 🟢 9.0x faster |
| get 1000 atoms | 8.2µs | 376.0µs | 🟢 45.4x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 10ns | 73ns | 🟢 7.7x faster |
| set + read 10 selectors | 10.6µs | 56.5µs | 🟢 5.6x faster |
| set + read 100 selectors | 56.3µs | 211.6µs | 🟢 3.8x faster |
| set + read through 5 chained selectors | 5.6µs | 11.4µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 72.5µs | 292.7µs | 🟢 4.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 207.0µs | 639.5µs | 🟢 4.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 993.2µs | 2.99ms | 🟢 3.1x faster |
| txn: cross-atom 1000 selectors, set + read | 773.7µs | 3.14ms | 🟢 4.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.83ms | 22.58ms | 🟢 10.6x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 31ns | 12ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 409ns | 550ns | 🟢 1.3x faster |
| selectorFamily(id) | 383ns | 494ns | 🟢 1.3x faster |
| createStore | 278ns | 6.1µs | 🟢 22.2x faster |
| sub + unsub | 1.4µs | 4.1µs | 🟢 3.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 12ns |
| jotai get | 361ns |
| obj.value = n | 1ns |
| map.set(key, n) | 17ns |
| valdres set | 186ns |
| jotai set | 3.2µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 28ns | 52ns | 🟢 1.7x faster |
| store.get(atom) | 23ns | 160ns | 🟢 7.5x faster |
| set(atom, value) | 273ns | 1.2µs | 🟢 4.3x faster |
| set(atom, curr => curr+1) | 271ns | 1.5µs | 🟢 5.5x faster |
| set(atom) with 10 subs | 451ns | 1.7µs | 🟢 4.0x faster |
| atom lifecycle (create+100get+100set) | 30.1µs | 136.4µs | 🟢 4.6x faster |
| set 1000 atoms | 81.9µs | 429.5µs | 🟢 5.3x faster |
| get 1000 atoms | 14.4µs | 205.6µs | 🟢 14.3x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 46ns | 58ns | 🟢 1.2x faster |
| set + read 10 selectors | 7.5µs | 14.6µs | 🟢 2.0x faster |
| set + read 100 selectors | 76.3µs | 133.5µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.1µs | 7.5µs | 🟢 1.8x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 146.2µs | 324.8µs | 🟢 2.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 96.0µs | 296.9µs | 🟢 3.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 874.5µs | 1.40ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 1.08ms | 1.91ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.57ms | 14.15ms | 🟢 9.2x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 7ns | 🔴 3.9x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 176ns | 547ns | 🟢 3.1x faster |
| sub + unsub | 738ns | 1.4µs | 🟢 1.9x faster |
| atomFamily(id) | 228ns | 254ns | 🟢 1.1x faster |
| selectorFamily(id) | 150ns | 187ns | 🟢 1.2x faster |

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
| valdres set | 256ns |
| jotai set | 1.3µs |
