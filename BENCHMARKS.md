# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-14

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 44ns | 🟢 23.1x faster |
| store.get(atom) | 30ns | 291ns | 🟢 9.7x faster |
| set(atom, value) | 140ns | 1.7µs | 🟢 11.9x faster |
| set(atom, curr => curr+1) | 135ns | 2.2µs | 🟢 16.1x faster |
| set(atom) with 10 subs | 147ns | 2.7µs | 🟢 18.5x faster |
| atom lifecycle (create+100get+100set) | 12.6µs | 224.6µs | 🟢 17.9x faster |
| set 1000 atoms | 54.8µs | 921.1µs | 🟢 16.8x faster |
| get 1000 atoms | 5.5µs | 365.8µs | 🟢 66.7x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 51ns | 🟢 9.0x faster |
| set + read 10 selectors | 6.8µs | 24.7µs | 🟢 3.6x faster |
| set + read 100 selectors | 60.7µs | 217.3µs | 🟢 3.6x faster |
| set + read through 5 chained selectors | 6.2µs | 12.6µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 62.7µs | 328.6µs | 🟢 5.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 109.8µs | 477.9µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 601.4µs | 2.83ms | 🟢 4.7x faster |
| txn: cross-atom 1000 selectors, set + read | 718.7µs | 3.12ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, with subs | 1.14ms | 17.04ms | 🟢 14.9x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 42ns | 9ns | 🔴 4.9x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 332ns | 454ns | 🟢 1.4x faster |
| selectorFamily(id) | 362ns | 447ns | 🟢 1.2x faster |
| createStore | 563ns | 5.3µs | 🟢 9.5x faster |
| sub + unsub | 391ns | 2.0µs | 🟢 5.0x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 12ns |
| valdres get | 7ns |
| jotai get | 277ns |
| obj.value = n | 4ns |
| map.set(key, n) | 13ns |
| valdres set | 146ns |
| jotai set | 2.6µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 22ns | 39ns | 🟢 1.8x faster |
| store.get(atom) | 10ns | 125ns | 🟢 12.7x faster |
| set(atom, value) | 212ns | 938ns | 🟢 4.4x faster |
| set(atom, curr => curr+1) | 228ns | 1.2µs | 🟢 5.1x faster |
| set(atom) with 10 subs | 239ns | 1.4µs | 🟢 5.7x faster |
| atom lifecycle (create+100get+100set) | 24.3µs | 109.0µs | 🟢 4.5x faster |
| set 1000 atoms | 71.6µs | 327.9µs | 🟢 4.6x faster |
| get 1000 atoms | 10.6µs | 165.3µs | 🟢 15.6x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 35ns | 43ns | 🟢 1.2x faster |
| set + read 10 selectors | 6.4µs | 15.7µs | 🟢 2.4x faster |
| set + read 100 selectors | 55.5µs | 100.0µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 3.7µs | 8.0µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 54.5µs | 107.0µs | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 59.0µs | 186.3µs | 🟢 3.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 609.7µs | 1.06ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 766.2µs | 1.47ms | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 754.8µs | 9.99ms | 🟢 13.2x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 18ns | 5ns | 🔴 3.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 124ns | 1.1µs | 🟢 8.9x faster |
| sub + unsub | 576ns | 1.7µs | 🟢 3.0x faster |
| atomFamily(id) | 468ns | 533ns | 🟢 1.1x faster |
| selectorFamily(id) | 362ns | 409ns | 🟢 1.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 4ns |
| valdres get | 10ns |
| jotai get | 156ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 211ns |
| jotai set | 1.1µs |
