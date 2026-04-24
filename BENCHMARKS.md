# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 52ns | 🟢 22.0x faster |
| store.get(atom) | 40ns | 361ns | 🟢 9.0x faster |
| set(atom, value) | 171ns | 2.0µs | 🟢 11.9x faster |
| set(atom, curr => curr+1) | 183ns | 2.6µs | 🟢 14.0x faster |
| set(atom) with 10 subs | 192ns | 3.4µs | 🟢 17.6x faster |
| atom lifecycle (create+100get+100set) | 16.0µs | 270.7µs | 🟢 16.9x faster |
| set 1000 atoms | 74.9µs | 1.14ms | 🟢 15.3x faster |
| get 1000 atoms | 6.7µs | 354.6µs | 🟢 52.7x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 59ns | 🟢 11.6x faster |
| set + read 10 selectors | 8.5µs | 27.4µs | 🟢 3.2x faster |
| set + read 100 selectors | 77.3µs | 323.3µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 7.7µs | 17.6µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 79.6µs | 393.0µs | 🟢 4.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 138.1µs | 702.8µs | 🟢 5.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 756.6µs | 4.40ms | 🟢 5.8x faster |
| txn: cross-atom 1000 selectors, set + read | 911.3µs | 4.64ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.41ms | 25.35ms | 🟢 18.0x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 11ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 302ns | 462ns | 🟢 1.5x faster |
| selectorFamily(id) | 314ns | 446ns | 🟢 1.4x faster |
| createStore | 603ns | 6.5µs | 🟢 10.8x faster |
| sub + unsub | 490ns | 2.4µs | 🟢 4.9x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 349ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 192ns |
| jotai set | 2.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 26ns | 51ns | 🟢 2.0x faster |
| store.get(atom) | 12ns | 158ns | 🟢 13.6x faster |
| set(atom, value) | 286ns | 1.2µs | 🟢 4.3x faster |
| set(atom, curr => curr+1) | 305ns | 1.5µs | 🟢 4.8x faster |
| set(atom) with 10 subs | 316ns | 1.7µs | 🟢 5.4x faster |
| atom lifecycle (create+100get+100set) | 31.9µs | 138.5µs | 🟢 4.3x faster |
| set 1000 atoms | 90.4µs | 441.9µs | 🟢 4.9x faster |
| get 1000 atoms | 14.6µs | 206.3µs | 🟢 14.1x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 42ns | 53ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.7µs | 19.8µs | 🟢 2.3x faster |
| set + read 100 selectors | 76.8µs | 128.3µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 4.8µs | 9.8µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 77.4µs | 138.6µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 79.7µs | 242.6µs | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 853.8µs | 1.32ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.05ms | 1.81ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.03ms | 12.66ms | 🟢 12.3x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 26ns | 6ns | 🔴 4.2x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 160ns | 1.3µs | 🟢 8.0x faster |
| sub + unsub | 774ns | 2.1µs | 🟢 2.8x faster |
| atomFamily(id) | 435ns | 527ns | 🟢 1.2x faster |
| selectorFamily(id) | 292ns | 362ns | 🟢 1.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 199ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 284ns |
| jotai set | 1.3µs |
