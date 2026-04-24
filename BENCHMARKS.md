# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 4ns | 51ns | 🟢 12.1x faster |
| store.get(atom) | 40ns | 370ns | 🟢 9.3x faster |
| set(atom, value) | 171ns | 2.1µs | 🟢 12.2x faster |
| set(atom, curr => curr+1) | 182ns | 2.7µs | 🟢 14.7x faster |
| set(atom) with 10 subs | 192ns | 3.7µs | 🟢 19.4x faster |
| atom lifecycle (create+100get+100set) | 16.0µs | 282.1µs | 🟢 17.6x faster |
| set 1000 atoms | 76.9µs | 1.17ms | 🟢 15.3x faster |
| get 1000 atoms | 6.8µs | 525.9µs | 🟢 77.9x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 60ns | 🟢 11.9x faster |
| set + read 10 selectors | 8.7µs | 29.5µs | 🟢 3.4x faster |
| set + read 100 selectors | 78.5µs | 321.8µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 7.6µs | 18.0µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 78.2µs | 293.3µs | 🟢 3.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 136.7µs | 596.2µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 749.9µs | 3.27ms | 🟢 4.4x faster |
| txn: cross-atom 1000 selectors, set + read | 898.8µs | 4.97ms | 🟢 5.5x faster |
| txn: cross-atom 1000 selectors, with subs | 1.44ms | 24.35ms | 🟢 16.9x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 29ns | 11ns | 🔴 2.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 341ns | 465ns | 🟢 1.4x faster |
| selectorFamily(id) | 325ns | 467ns | 🟢 1.4x faster |
| createStore | 589ns | 6.6µs | 🟢 11.3x faster |
| sub + unsub | 461ns | 2.5µs | 🟢 5.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 7ns |
| jotai get | 345ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 190ns |
| jotai set | 3.2µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 25ns | 48ns | 🟢 1.9x faster |
| store.get(atom) | 12ns | 159ns | 🟢 13.6x faster |
| set(atom, value) | 291ns | 1.3µs | 🟢 4.3x faster |
| set(atom, curr => curr+1) | 306ns | 1.5µs | 🟢 5.0x faster |
| set(atom) with 10 subs | 330ns | 1.8µs | 🟢 5.5x faster |
| atom lifecycle (create+100get+100set) | 32.8µs | 143.3µs | 🟢 4.4x faster |
| set 1000 atoms | 89.1µs | 443.2µs | 🟢 5.0x faster |
| get 1000 atoms | 13.9µs | 214.7µs | 🟢 15.5x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 44ns | 52ns | 🟢 1.2x faster |
| set + read 10 selectors | 9.1µs | 20.2µs | 🟢 2.2x faster |
| set + read 100 selectors | 80.1µs | 130.5µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 5.2µs | 9.8µs | 🟢 1.9x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 78.0µs | 142.1µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 77.6µs | 245.0µs | 🟢 3.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 858.1µs | 1.32ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.08ms | 1.97ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.02ms | 12.60ms | 🟢 12.4x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 26ns | 7ns | 🔴 3.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 159ns | 1.5µs | 🟢 9.6x faster |
| sub + unsub | 805ns | 2.1µs | 🟢 2.6x faster |
| atomFamily(id) | 411ns | 476ns | 🟢 1.2x faster |
| selectorFamily(id) | 339ns | 355ns | 🟢 1.0x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 198ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 296ns |
| jotai set | 1.4µs |
