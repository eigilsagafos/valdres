# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-28

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 52ns | 🟢 21.0x faster |
| store.get(atom) | 40ns | 370ns | 🟢 9.3x faster |
| set(atom, value) | 171ns | 2.0µs | 🟢 12.0x faster |
| set(atom, curr => curr+1) | 151ns | 2.7µs | 🟢 17.7x faster |
| set(atom) with 10 subs | 192ns | 3.6µs | 🟢 18.5x faster |
| atom lifecycle (create+100get+100set) | 15.7µs | 273.2µs | 🟢 17.4x faster |
| set 1000 atoms | 74.2µs | 1.20ms | 🟢 16.2x faster |
| get 1000 atoms | 6.8µs | 364.1µs | 🟢 53.3x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 58ns | 🟢 11.6x faster |
| set + read 10 selectors | 8.8µs | 30.9µs | 🟢 3.5x faster |
| set + read 100 selectors | 81.3µs | 263.3µs | 🟢 3.2x faster |
| set + read through 5 chained selectors | 7.8µs | 18.3µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 81.7µs | 310.0µs | 🟢 3.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 142.9µs | 620.9µs | 🟢 4.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 805.2µs | 3.34ms | 🟢 4.2x faster |
| txn: cross-atom 1000 selectors, set + read | 950.6µs | 3.76ms | 🟢 4.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.46ms | 21.15ms | 🟢 14.4x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 27ns | 11ns | 🔴 2.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 324ns | 477ns | 🟢 1.5x faster |
| selectorFamily(id) | 325ns | 468ns | 🟢 1.4x faster |
| createStore | 654ns | 7.0µs | 🟢 10.7x faster |
| sub + unsub | 531ns | 2.4µs | 🟢 4.6x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 12ns |
| jotai get | 449ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 171ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 25ns | 49ns | 🟢 2.0x faster |
| store.get(atom) | 13ns | 160ns | 🟢 12.6x faster |
| set(atom, value) | 274ns | 1.3µs | 🟢 4.6x faster |
| set(atom, curr => curr+1) | 276ns | 1.5µs | 🟢 5.4x faster |
| set(atom) with 10 subs | 322ns | 1.7µs | 🟢 5.3x faster |
| atom lifecycle (create+100get+100set) | 32.3µs | 141.9µs | 🟢 4.4x faster |
| set 1000 atoms | 79.1µs | 452.6µs | 🟢 5.7x faster |
| get 1000 atoms | 14.8µs | 206.4µs | 🟢 13.9x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 42ns | 54ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.8µs | 19.3µs | 🟢 2.2x faster |
| set + read 100 selectors | 76.3µs | 126.3µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 5.0µs | 9.8µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 77.6µs | 140.7µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 78.4µs | 237.9µs | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 857.6µs | 1.30ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.07ms | 1.81ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.03ms | 12.52ms | 🟢 12.1x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 26ns | 6ns | 🔴 4.2x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 163ns | 1.2µs | 🟢 7.5x faster |
| sub + unsub | 822ns | 2.1µs | 🟢 2.5x faster |
| atomFamily(id) | 425ns | 477ns | 🟢 1.1x faster |
| selectorFamily(id) | 338ns | 358ns | 🟢 1.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 13ns |
| jotai get | 199ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 264ns |
| jotai set | 1.4µs |
