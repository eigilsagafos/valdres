# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-23

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 57ns | 🟢 20.0x faster |
| store.get(atom) | 40ns | 511ns | 🟢 12.8x faster |
| set(atom, value) | 200ns | 2.5µs | 🟢 12.5x faster |
| set(atom, curr => curr+1) | 210ns | 2.9µs | 🟢 13.9x faster |
| set(atom) with 10 subs | 190ns | 4.1µs | 🟢 21.6x faster |
| atom lifecycle (create+100get+100set) | 17.3µs | 298.7µs | 🟢 17.3x faster |
| set 1000 atoms | 74.2µs | 1.52ms | 🟢 20.6x faster |
| get 1000 atoms | 10.2µs | 773.8µs | 🟢 76.1x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 64ns | 🟢 10.6x faster |
| set + read 10 selectors | 9.1µs | 35.1µs | 🟢 3.9x faster |
| set + read 100 selectors | 82.9µs | 337.6µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 8.0µs | 19.0µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 86.4µs | 318.7µs | 🟢 3.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 108.5µs | 654.4µs | 🟢 6.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 751.6µs | 3.53ms | 🟢 4.7x faster |
| txn: cross-atom 1000 selectors, set + read | 900.9µs | 4.91ms | 🟢 5.5x faster |
| txn: cross-atom 1000 selectors, with subs | 1.12ms | 22.30ms | 🟢 19.9x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 32ns | 11ns | 🔴 2.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 395ns | 533ns | 🟢 1.3x faster |
| selectorFamily(id) | 405ns | 530ns | 🟢 1.3x faster |
| createStore | 675ns | 6.9µs | 🟢 10.2x faster |
| sub + unsub | 551ns | 3.1µs | 🟢 5.7x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 357ns |
| obj.value = n | 5ns |
| map.set(key, n) | 17ns |
| valdres set | 198ns |
| jotai set | 3.5µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 26ns | 48ns | 🟢 1.8x faster |
| store.get(atom) | 13ns | 163ns | 🟢 12.8x faster |
| set(atom, value) | 274ns | 1.2µs | 🟢 4.3x faster |
| set(atom, curr => curr+1) | 289ns | 1.4µs | 🟢 4.9x faster |
| set(atom) with 10 subs | 311ns | 1.7µs | 🟢 5.5x faster |
| atom lifecycle (create+100get+100set) | 30.7µs | 140.6µs | 🟢 4.6x faster |
| set 1000 atoms | 96.4µs | 417.2µs | 🟢 4.3x faster |
| get 1000 atoms | 13.8µs | 208.6µs | 🟢 15.1x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 51ns | 🟢 1.2x faster |
| set + read 10 selectors | 8.0µs | 19.4µs | 🟢 2.4x faster |
| set + read 100 selectors | 70.3µs | 127.9µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.6µs | 9.9µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 69.5µs | 143.7µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 74.0µs | 232.0µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 799.0µs | 1.30ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 981.2µs | 1.81ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 952.7µs | 12.60ms | 🟢 13.2x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 23ns | 7ns | 🔴 3.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 157ns | 1.2µs | 🟢 7.5x faster |
| sub + unsub | 705ns | 2.1µs | 🟢 2.9x faster |
| atomFamily(id) | 448ns | 547ns | 🟢 1.2x faster |
| selectorFamily(id) | 334ns | 393ns | 🟢 1.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 13ns |
| jotai get | 206ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 286ns |
| jotai set | 1.3µs |
