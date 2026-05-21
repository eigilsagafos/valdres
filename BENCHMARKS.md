# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-21

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 57ns | 🟢 23.0x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 180ns | 2.1µs | 🟢 11.6x faster |
| set(atom, curr => curr+1) | 147ns | 2.6µs | 🟢 17.9x faster |
| set(atom) with 10 subs | 188ns | 3.7µs | 🟢 19.6x faster |
| atom lifecycle (create+100get+100set) | 17.0µs | 282.4µs | 🟢 16.6x faster |
| set 1000 atoms | 72.1µs | 1.19ms | 🟢 16.6x faster |
| get 1000 atoms | 7.3µs | 369.4µs | 🟢 50.6x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 62ns | 🟢 10.3x faster |
| set + read 10 selectors | 8.8µs | 32.2µs | 🟢 3.7x faster |
| set + read 100 selectors | 79.7µs | 353.9µs | 🟢 4.4x faster |
| set + read through 5 chained selectors | 8.1µs | 19.0µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 82.5µs | 414.1µs | 🟢 5.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 143.8µs | 724.7µs | 🟢 5.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 814.1µs | 4.85ms | 🟢 6.0x faster |
| txn: cross-atom 1000 selectors, set + read | 952.8µs | 5.15ms | 🟢 5.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.46ms | 26.79ms | 🟢 18.3x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 31ns | 11ns | 🔴 2.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 391ns | 538ns | 🟢 1.4x faster |
| selectorFamily(id) | 410ns | 558ns | 🟢 1.4x faster |
| createStore | 718ns | 7.1µs | 🟢 9.8x faster |
| sub + unsub | 461ns | 2.4µs | 🟢 5.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 13ns |
| jotai get | 358ns |
| obj.value = n | 5ns |
| map.set(key, n) | 16ns |
| valdres set | 180ns |
| jotai set | 2.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 27ns | 49ns | 🟢 1.9x faster |
| store.get(atom) | 14ns | 165ns | 🟢 11.8x faster |
| set(atom, value) | 258ns | 1.2µs | 🟢 4.7x faster |
| set(atom, curr => curr+1) | 255ns | 1.5µs | 🟢 5.9x faster |
| set(atom) with 10 subs | 309ns | 1.7µs | 🟢 5.6x faster |
| atom lifecycle (create+100get+100set) | 31.7µs | 140.6µs | 🟢 4.4x faster |
| set 1000 atoms | 80.1µs | 420.3µs | 🟢 5.2x faster |
| get 1000 atoms | 14.5µs | 205.2µs | 🟢 14.2x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 53ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.1µs | 20.3µs | 🟢 2.5x faster |
| set + read 100 selectors | 70.7µs | 129.5µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.7µs | 10.3µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 73.4µs | 140.9µs | 🟢 1.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 71.7µs | 243.4µs | 🟢 3.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 778.1µs | 1.34ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 989.4µs | 1.92ms | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 969.7µs | 13.33ms | 🟢 13.8x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 23ns | 7ns | 🔴 3.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 157ns | 1.2µs | 🟢 7.8x faster |
| sub + unsub | 699ns | 2.2µs | 🟢 3.1x faster |
| atomFamily(id) | 530ns | 613ns | 🟢 1.2x faster |
| selectorFamily(id) | 382ns | 437ns | 🟢 1.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 14ns |
| jotai get | 202ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 260ns |
| jotai set | 1.3µs |
