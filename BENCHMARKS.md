# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-27

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 54ns | 🟢 22.0x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 180ns | 2.1µs | 🟢 11.8x faster |
| set(atom, curr => curr+1) | 146ns | 2.6µs | 🟢 18.0x faster |
| set(atom) with 10 subs | 188ns | 3.4µs | 🟢 18.4x faster |
| atom lifecycle (create+100get+100set) | 16.7µs | 277.7µs | 🟢 16.6x faster |
| set 1000 atoms | 71.2µs | 1.20ms | 🟢 16.9x faster |
| get 1000 atoms | 4.4µs | 370.5µs | 🟢 84.7x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 76ns | 🟢 12.2x faster |
| set + read 10 selectors | 8.5µs | 28.2µs | 🟢 3.3x faster |
| set + read 100 selectors | 76.5µs | 348.4µs | 🟢 4.6x faster |
| set + read through 5 chained selectors | 7.9µs | 19.0µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 83.7µs | 406.9µs | 🟢 4.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 111.7µs | 686.3µs | 🟢 6.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 748.3µs | 4.61ms | 🟢 6.2x faster |
| txn: cross-atom 1000 selectors, set + read | 908.3µs | 4.97ms | 🟢 5.5x faster |
| txn: cross-atom 1000 selectors, with subs | 1.14ms | 25.53ms | 🟢 22.3x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 55ns | 11ns | 🔴 4.9x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 346ns | 511ns | 🟢 1.5x faster |
| selectorFamily(id) | 382ns | 496ns | 🟢 1.3x faster |
| createStore | 713ns | 6.8µs | 🟢 9.6x faster |
| sub + unsub | 501ns | 2.4µs | 🟢 4.8x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 14ns |
| jotai get | 358ns |
| obj.value = n | 5ns |
| map.set(key, n) | 18ns |
| valdres set | 180ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 27ns | 48ns | 🟢 1.8x faster |
| store.get(atom) | 14ns | 160ns | 🟢 11.5x faster |
| set(atom, value) | 259ns | 1.2µs | 🟢 4.7x faster |
| set(atom, curr => curr+1) | 258ns | 1.5µs | 🟢 6.0x faster |
| set(atom) with 10 subs | 297ns | 1.7µs | 🟢 5.8x faster |
| atom lifecycle (create+100get+100set) | 30.2µs | 140.0µs | 🟢 4.6x faster |
| set 1000 atoms | 81.1µs | 427.5µs | 🟢 5.3x faster |
| get 1000 atoms | 14.5µs | 204.6µs | 🟢 14.1x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 42ns | 53ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.3µs | 19.5µs | 🟢 2.4x faster |
| set + read 100 selectors | 68.9µs | 131.9µs | 🟢 1.9x faster |
| set + read through 5 chained selectors | 4.3µs | 10.1µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 70.2µs | 138.7µs | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 73.8µs | 231.7µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 767.0µs | 1.34ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, set + read | 981.3µs | 1.82ms | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 971.7µs | 12.50ms | 🟢 12.9x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 22ns | 7ns | 🔴 3.3x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 154ns | 1.2µs | 🟢 7.8x faster |
| sub + unsub | 698ns | 2.0µs | 🟢 2.9x faster |
| atomFamily(id) | 434ns | 551ns | 🟢 1.3x faster |
| selectorFamily(id) | 296ns | 405ns | 🟢 1.4x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 5ns |
| valdres get | 14ns |
| jotai get | 202ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 260ns |
| jotai set | 1.3µs |
