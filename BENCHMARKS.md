# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-21

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 44ns | 🟢 21.5x faster |
| store.get(atom) | 30ns | 291ns | 🟢 9.7x faster |
| set(atom, value) | 140ns | 1.6µs | 🟢 11.7x faster |
| set(atom, curr => curr+1) | 113ns | 2.1µs | 🟢 18.5x faster |
| set(atom) with 10 subs | 145ns | 2.8µs | 🟢 19.1x faster |
| atom lifecycle (create+100get+100set) | 13.1µs | 218.9µs | 🟢 16.7x faster |
| set 1000 atoms | 55.2µs | 962.6µs | 🟢 17.4x faster |
| get 1000 atoms | 5.8µs | 444.3µs | 🟢 76.6x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 51ns | 🟢 9.4x faster |
| set + read 10 selectors | 7.0µs | 25.8µs | 🟢 3.7x faster |
| set + read 100 selectors | 63.8µs | 287.1µs | 🟢 4.5x faster |
| set + read through 5 chained selectors | 6.6µs | 15.3µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 66.1µs | 258.9µs | 🟢 3.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 117.3µs | 510.1µs | 🟢 4.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 627.1µs | 2.93ms | 🟢 4.7x faster |
| txn: cross-atom 1000 selectors, set + read | 748.3µs | 4.10ms | 🟢 5.5x faster |
| txn: cross-atom 1000 selectors, with subs | 1.19ms | 21.31ms | 🟢 17.9x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 24ns | 9ns | 🔴 2.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 316ns | 452ns | 🟢 1.4x faster |
| selectorFamily(id) | 338ns | 452ns | 🟢 1.3x faster |
| createStore | 610ns | 5.6µs | 🟢 9.3x faster |
| sub + unsub | 370ns | 2.0µs | 🟢 5.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 12ns |
| valdres get | 10ns |
| jotai get | 277ns |
| obj.value = n | 4ns |
| map.set(key, n) | 13ns |
| valdres set | 140ns |
| jotai set | 1.9µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 21ns | 38ns | 🟢 1.8x faster |
| store.get(atom) | 11ns | 124ns | 🟢 11.5x faster |
| set(atom, value) | 196ns | 931ns | 🟢 4.8x faster |
| set(atom, curr => curr+1) | 195ns | 1.2µs | 🟢 5.9x faster |
| set(atom) with 10 subs | 218ns | 1.3µs | 🟢 6.1x faster |
| atom lifecycle (create+100get+100set) | 23.1µs | 109.0µs | 🟢 4.7x faster |
| set 1000 atoms | 61.8µs | 328.1µs | 🟢 5.3x faster |
| get 1000 atoms | 11.3µs | 159.8µs | 🟢 14.2x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 34ns | 42ns | 🟢 1.3x faster |
| set + read 10 selectors | 6.3µs | 15.6µs | 🟢 2.5x faster |
| set + read 100 selectors | 55.3µs | 100.3µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 3.7µs | 7.8µs | 🟢 2.1x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 52.5µs | 109.1µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 54.7µs | 185.2µs | 🟢 3.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 613.2µs | 1.06ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 773.0µs | 1.45ms | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 738.7µs | 10.17ms | 🟢 13.8x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 18ns | 5ns | 🔴 3.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 122ns | 1.1µs | 🟢 8.6x faster |
| sub + unsub | 539ns | 1.8µs | 🟢 3.3x faster |
| atomFamily(id) | 414ns | 517ns | 🟢 1.2x faster |
| selectorFamily(id) | 324ns | 380ns | 🟢 1.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 4ns |
| valdres get | 11ns |
| jotai get | 157ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 205ns |
| jotai set | 1.0µs |
