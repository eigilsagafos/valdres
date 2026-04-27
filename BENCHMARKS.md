# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-27

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 42ns | 🟢 22.2x faster |
| store.get(atom) | 30ns | 291ns | 🟢 9.7x faster |
| set(atom, value) | 140ns | 1.6µs | 🟢 11.6x faster |
| set(atom, curr => curr+1) | 113ns | 2.1µs | 🟢 18.2x faster |
| set(atom) with 10 subs | 145ns | 2.8µs | 🟢 19.6x faster |
| atom lifecycle (create+100get+100set) | 13.7µs | 218.7µs | 🟢 15.9x faster |
| set 1000 atoms | 55.9µs | 918.0µs | 🟢 16.4x faster |
| get 1000 atoms | 5.6µs | 427.3µs | 🟢 76.3x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 50ns | 🟢 8.7x faster |
| set + read 10 selectors | 6.7µs | 24.5µs | 🟢 3.6x faster |
| set + read 100 selectors | 61.6µs | 271.9µs | 🟢 4.4x faster |
| set + read through 5 chained selectors | 6.2µs | 14.5µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 62.6µs | 244.4µs | 🟢 3.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 110.3µs | 489.2µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 609.9µs | 2.78ms | 🟢 4.6x faster |
| txn: cross-atom 1000 selectors, set + read | 739.5µs | 3.90ms | 🟢 5.3x faster |
| txn: cross-atom 1000 selectors, with subs | 1.12ms | 20.10ms | 🟢 18.0x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 24ns | 9ns | 🔴 2.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 300ns | 437ns | 🟢 1.5x faster |
| selectorFamily(id) | 319ns | 428ns | 🟢 1.3x faster |
| createStore | 559ns | 5.4µs | 🟢 9.6x faster |
| sub + unsub | 370ns | 1.9µs | 🟢 5.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 12ns |
| valdres get | 9ns |
| jotai get | 277ns |
| obj.value = n | 4ns |
| map.set(key, n) | 13ns |
| valdres set | 140ns |
| jotai set | 2.5µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 21ns | 38ns | 🟢 1.8x faster |
| store.get(atom) | 11ns | 125ns | 🟢 11.6x faster |
| set(atom, value) | 198ns | 925ns | 🟢 4.7x faster |
| set(atom, curr => curr+1) | 195ns | 1.2µs | 🟢 6.0x faster |
| set(atom) with 10 subs | 223ns | 1.4µs | 🟢 6.1x faster |
| atom lifecycle (create+100get+100set) | 23.1µs | 106.2µs | 🟢 4.6x faster |
| set 1000 atoms | 61.8µs | 326.7µs | 🟢 5.3x faster |
| get 1000 atoms | 11.3µs | 159.7µs | 🟢 14.2x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 34ns | 41ns | 🟢 1.2x faster |
| set + read 10 selectors | 6.3µs | 15.3µs | 🟢 2.4x faster |
| set + read 100 selectors | 53.7µs | 99.5µs | 🟢 1.9x faster |
| set + read through 5 chained selectors | 3.5µs | 7.8µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 52.3µs | 107.3µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 54.3µs | 184.8µs | 🟢 3.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 609.1µs | 1.01ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 743.7µs | 1.39ms | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 739.3µs | 9.74ms | 🟢 13.2x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 18ns | 6ns | 🔴 3.3x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 121ns | 966ns | 🟢 8.0x faster |
| sub + unsub | 542ns | 1.7µs | 🟢 3.1x faster |
| atomFamily(id) | 402ns | 464ns | 🟢 1.2x faster |
| selectorFamily(id) | 306ns | 363ns | 🟢 1.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 11ns |
| jotai get | 157ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 190ns |
| jotai set | 1.0µs |
