# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-29

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 9ns | 79ns | 🟢 8.2x faster |
| store.get(atom) | 13ns | 355ns | 🟢 27.2x faster |
| set(atom, value) | 210ns | 4.4µs | 🟢 21.5x faster |
| set(atom, curr => curr+1) | 119ns | 3.2µs | 🟢 28.7x faster |
| set(atom) with 10 subs | 157ns | 3.7µs | 🟢 23.6x faster |
| atom lifecycle (create+100get+100set) | 11.3µs | 284.3µs | 🟢 25.4x faster |
| set 1000 atoms | 76.3µs | 919.9µs | 🟢 12.1x faster |
| get 1000 atoms | 8.7µs | 476.6µs | 🟢 54.6x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 10ns | 74ns | 🟢 7.0x faster |
| set + read 10 selectors | 6.6µs | 38.8µs | 🟢 5.5x faster |
| set + read 100 selectors | 64.6µs | 362.9µs | 🟢 5.1x faster |
| set + read 100 selectorFamily entries | 65.0µs | 364.1µs | 🟢 5.5x faster |
| set + read through 5 chained selectors | 5.5µs | 13.9µs | 🟢 2.6x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 76.7µs | 243.7µs | 🟢 3.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 119.8µs | 507.9µs | 🟢 4.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 944.6µs | 3.05ms | 🟢 3.3x faster |
| txn: cross-atom 1000 selectors, set + read | 854.8µs | 3.17ms | 🟢 3.8x faster |
| txn: asymmetric DAG shared sink | 53.7µs | 199.1µs | 🟢 3.7x faster |
| txn: large asymmetric DAG (1000 leaves × 50 chain) | 5.54ms | 16.59ms | 🟢 2.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.84ms | 21.67ms | 🟢 12.1x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 32ns | 12ns | 🔴 2.5x slower |

#### Other

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 76.6µs | 118.0µs | 🟢 1.5x faster |
| sub+unsub on chain of 100 unsubscribed derived deps | 134.2µs | 158.0µs | 🟢 1.2x faster |
| sub+unsub on chain of 500 unsubscribed derived deps | 893.3µs | 898.7µs | 🟢 1.2x faster |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 411ns | 553ns | 🟢 1.4x faster |
| selectorFamily(id) | 388ns | 416ns | 🟢 1.1x faster |
| createStore | 326ns | 6.3µs | 🟢 19.4x faster |
| sub + unsub | 1.4µs | 4.0µs | 🟢 2.8x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 12ns |
| jotai get | 364ns |
| obj.value = n | 5ns |
| map.set(key, n) | 17ns |
| valdres set | 124ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 28ns | 55ns | 🟢 1.8x faster |
| store.get(atom) | 23ns | 165ns | 🟢 7.3x faster |
| set(atom, value) | 212ns | 1.2µs | 🟢 5.7x faster |
| set(atom, curr => curr+1) | 215ns | 1.4µs | 🟢 6.8x faster |
| set(atom) with 10 subs | 263ns | 1.7µs | 🟢 6.6x faster |
| atom lifecycle (create+100get+100set) | 24.2µs | 137.9µs | 🟢 5.8x faster |
| set 1000 atoms | 80.9µs | 427.3µs | 🟢 5.3x faster |
| get 1000 atoms | 14.5µs | 206.3µs | 🟢 14.2x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 52ns | 64ns | 🟢 1.2x faster |
| set + read 10 selectors | 6.4µs | 14.4µs | 🟢 2.2x faster |
| set + read 100 selectors | 66.2µs | 137.4µs | 🟢 2.0x faster |
| set + read 100 selectorFamily entries | 67.0µs | 130.9µs | 🟢 2.0x faster |
| set + read through 5 chained selectors | 4.5µs | 7.3µs | 🟢 1.6x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 128.0µs | 314.7µs | 🟢 2.5x faster |
| txn: 10 atoms × 10 selectors, with subs | 97.4µs | 288.4µs | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 978.9µs | 1.45ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.17ms | 2.14ms | 🟢 1.8x faster |
| txn: asymmetric DAG shared sink | 27.6µs | 60.0µs | 🟢 2.2x faster |
| txn: large asymmetric DAG (1000 leaves × 50 chain) | 4.26ms | 10.65ms | 🟢 2.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.59ms | 14.54ms | 🟢 8.9x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 27ns | 11ns | 🔴 2.5x slower |

#### Other

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 88.8µs | 57.4µs | 🟡 1.5x slower |
| sub+unsub on chain of 100 unsubscribed derived deps | 168.3µs | 108.1µs | 🟡 1.6x slower |
| sub+unsub on chain of 500 unsubscribed derived deps | 762.0µs | 518.8µs | 🟡 1.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 193ns | 569ns | 🟢 2.9x faster |
| sub + unsub | 796ns | 1.4µs | 🟢 1.8x faster |
| atomFamily(id) | 301ns | 323ns | 🟢 1.1x faster |
| selectorFamily(id) | 297ns | 325ns | 🟢 1.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 10ns |
| valdres get | 18ns |
| jotai get | 203ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 198ns |
| jotai set | 1.3µs |
