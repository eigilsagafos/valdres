# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-22

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 6ns | 60ns | 🟢 10.4x faster |
| store.get(atom) | 13ns | 340ns | 🟢 26.9x faster |
| set(atom, value) | 292ns | 4.7µs | 🟢 16.6x faster |
| set(atom, curr => curr+1) | 128ns | 2.8µs | 🟢 21.6x faster |
| set(atom) with 10 subs | 215ns | 3.4µs | 🟢 16.2x faster |
| atom lifecycle (create+100get+100set) | 13.0µs | 272.5µs | 🟢 21.1x faster |
| set 1000 atoms | 82.6µs | 961.8µs | 🟢 11.7x faster |
| get 1000 atoms | 8.5µs | 358.1µs | 🟢 42.2x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 62ns | 🟢 9.7x faster |
| set + read 10 selectors | 7.1µs | 38.8µs | 🟢 5.2x faster |
| set + read 100 selectors | 65.1µs | 271.3µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 7.0µs | 20.4µs | 🟢 2.9x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 73.8µs | 394.1µs | 🟢 5.3x faster |
| txn: 10 atoms × 10 selectors, with subs | 119.5µs | 624.5µs | 🟢 5.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 904.7µs | 3.69ms | 🟢 4.1x faster |
| txn: cross-atom 1000 selectors, set + read | 886.3µs | 3.83ms | 🟢 4.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.46ms | 23.07ms | 🟢 14.8x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 29ns | 11ns | 🔴 2.5x slower |

#### Other

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 86.6µs | 118.4µs | 🟢 1.4x faster |
| sub+unsub on chain of 100 unsubscribed derived deps | 194.8µs | 226.7µs | 🟢 1.2x faster |
| sub+unsub on chain of 500 unsubscribed derived deps | 736.9µs | 678.0µs | 🟢 1.1x faster |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 272ns | 386ns | 🟢 1.4x faster |
| selectorFamily(id) | 311ns | 411ns | 🟢 1.3x faster |
| createStore | 232ns | 6.0µs | 🟢 25.9x faster |
| sub + unsub | 1.3µs | 3.6µs | 🟢 2.9x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 11ns |
| jotai get | 349ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 146ns |
| jotai set | 3.1µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 25ns | 56ns | 🟢 2.0x faster |
| store.get(atom) | 24ns | 163ns | 🟢 6.9x faster |
| set(atom, value) | 212ns | 1.2µs | 🟢 5.8x faster |
| set(atom, curr => curr+1) | 219ns | 1.5µs | 🟢 6.7x faster |
| set(atom) with 10 subs | 258ns | 1.7µs | 🟢 6.5x faster |
| atom lifecycle (create+100get+100set) | 23.8µs | 145.4µs | 🟢 6.2x faster |
| set 1000 atoms | 81.0µs | 482.9µs | 🟢 6.0x faster |
| get 1000 atoms | 16.3µs | 207.5µs | 🟢 12.9x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 42ns | 56ns | 🟢 1.2x faster |
| set + read 10 selectors | 7.3µs | 14.1µs | 🟢 1.9x faster |
| set + read 100 selectors | 75.1µs | 127.2µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 4.4µs | 7.1µs | 🟢 1.6x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 145.1µs | 296.4µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 108.2µs | 284.0µs | 🟢 2.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 871.7µs | 1.35ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.07ms | 1.80ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.36ms | 12.29ms | 🟢 8.3x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 78ns | 16ns | 🔴 4.9x slower |

#### Other

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 101.7µs | 57.9µs | 🟡 1.8x slower |
| sub+unsub on chain of 100 unsubscribed derived deps | 193.9µs | 108.8µs | 🟡 1.8x slower |
| sub+unsub on chain of 500 unsubscribed derived deps | 910.3µs | 528.4µs | 🟡 1.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 170ns | 491ns | 🟢 2.9x faster |
| sub + unsub | 869ns | 1.4µs | 🟢 1.6x faster |
| atomFamily(id) | 181ns | 214ns | 🟢 1.3x faster |
| selectorFamily(id) | 138ns | 180ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 9ns |
| valdres get | 17ns |
| jotai get | 198ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 200ns |
| jotai set | 1.4µs |
