# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 52ns | 🟢 19.8x faster |
| store.get(atom) | 40ns | 511ns | 🟢 12.8x faster |
| set(atom, value) | 170ns | 2.2µs | 🟢 12.7x faster |
| set(atom, curr => curr+1) | 179ns | 2.7µs | 🟢 15.1x faster |
| set(atom) with 10 subs | 194ns | 3.7µs | 🟢 19.1x faster |
| atom lifecycle (create+100get+100set) | 16.0µs | 287.0µs | 🟢 17.9x faster |
| set 1000 atoms | 74.9µs | 1.18ms | 🟢 15.7x faster |
| get 1000 atoms | 6.6µs | 363.7µs | 🟢 55.0x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 72ns | 🟢 13.7x faster |
| set + read 10 selectors | 8.4µs | 27.9µs | 🟢 3.3x faster |
| set + read 100 selectors | 79.9µs | 326.3µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 7.7µs | 17.9µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 81.3µs | 422.0µs | 🟢 5.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 140.4µs | 735.5µs | 🟢 5.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 769.9µs | 4.57ms | 🟢 5.9x faster |
| txn: cross-atom 1000 selectors, set + read | 910.4µs | 4.72ms | 🟢 5.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.40ms | 24.48ms | 🟢 17.4x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 325ns | 477ns | 🟢 1.5x faster |
| selectorFamily(id) | 346ns | 460ns | 🟢 1.3x faster |
| createStore | 636ns | 6.7µs | 🟢 10.5x faster |
| sub + unsub | 480ns | 2.5µs | 🟢 5.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 351ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 190ns |
| jotai set | 3.2µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 52ns | 🟢 2.1x faster |
| store.get(atom) | 12ns | 157ns | 🟢 13.5x faster |
| set(atom, value) | 287ns | 1.2µs | 🟢 4.3x faster |
| set(atom, curr => curr+1) | 306ns | 1.4µs | 🟢 4.7x faster |
| set(atom) with 10 subs | 316ns | 1.7µs | 🟢 5.4x faster |
| atom lifecycle (create+100get+100set) | 30.5µs | 139.0µs | 🟢 4.6x faster |
| set 1000 atoms | 90.6µs | 454.6µs | 🟢 5.0x faster |
| get 1000 atoms | 14.8µs | 221.2µs | 🟢 15.0x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 47ns | 53ns | 🟢 1.1x faster |
| set + read 10 selectors | 8.8µs | 19.5µs | 🟢 2.2x faster |
| set + read 100 selectors | 76.5µs | 126.1µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 4.9µs | 9.9µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 77.8µs | 139.9µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 77.7µs | 237.0µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 857.3µs | 1.27ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.07ms | 1.85ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.02ms | 12.66ms | 🟢 12.5x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 25ns | 6ns | 🔴 4.1x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 159ns | 1.3µs | 🟢 8.1x faster |
| sub + unsub | 771ns | 2.2µs | 🟢 2.8x faster |
| atomFamily(id) | 417ns | 539ns | 🟢 1.3x faster |
| selectorFamily(id) | 358ns | 364ns | 🟢 1.0x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 198ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 284ns |
| jotai set | 1.3µs |
