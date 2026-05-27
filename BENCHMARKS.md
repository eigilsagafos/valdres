# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-27

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 5ns | 61ns | 🟢 11.6x faster |
| store.get(atom) | 13ns | 341ns | 🟢 26.6x faster |
| set(atom, value) | 146ns | 3.1µs | 🟢 19.2x faster |
| set(atom, curr => curr+1) | 112ns | 3.0µs | 🟢 26.8x faster |
| set(atom) with 10 subs | 162ns | 3.6µs | 🟢 21.9x faster |
| atom lifecycle (create+100get+100set) | 11.4µs | 269.5µs | 🟢 23.9x faster |
| set 1000 atoms | 80.6µs | 957.6µs | 🟢 11.9x faster |
| get 1000 atoms | 8.1µs | 362.6µs | 🟢 44.5x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 7ns | 62ns | 🟢 8.3x faster |
| set + read 10 selectors | 7.5µs | 39.0µs | 🟢 4.9x faster |
| set + read 100 selectors | 68.4µs | 377.1µs | 🟢 5.4x faster |
| set + read through 5 chained selectors | 7.4µs | 19.0µs | 🟢 2.6x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 75.7µs | 403.9µs | 🟢 5.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 132.0µs | 653.5µs | 🟢 4.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 945.7µs | 3.67ms | 🟢 3.9x faster |
| txn: cross-atom 1000 selectors, set + read | 919.0µs | 3.93ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, with subs | 1.53ms | 23.22ms | 🟢 14.9x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 48ns | 13ns | 🔴 3.6x slower |

#### Other

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 75.2µs | 116.6µs | 🟢 1.6x faster |
| sub+unsub on chain of 100 unsubscribed derived deps | 120.0µs | 147.1µs | 🟢 1.2x faster |
| sub+unsub on chain of 500 unsubscribed derived deps | 648.0µs | 724.1µs | 🟢 1.1x faster |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 260ns | 380ns | 🟢 1.5x faster |
| selectorFamily(id) | 208ns | 227ns | 🟢 1.2x faster |
| createStore | 299ns | 6.0µs | 🟢 20.3x faster |
| sub + unsub | 1.3µs | 3.7µs | 🟢 2.9x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 11ns |
| jotai get | 349ns |
| obj.value = n | 5ns |
| map.set(key, n) | 17ns |
| valdres set | 121ns |
| jotai set | 2.4µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 25ns | 51ns | 🟢 1.9x faster |
| store.get(atom) | 23ns | 164ns | 🟢 7.1x faster |
| set(atom, value) | 239ns | 1.2µs | 🟢 5.2x faster |
| set(atom, curr => curr+1) | 246ns | 1.4µs | 🟢 5.9x faster |
| set(atom) with 10 subs | 271ns | 1.7µs | 🟢 6.4x faster |
| atom lifecycle (create+100get+100set) | 26.0µs | 141.4µs | 🟢 5.5x faster |
| set 1000 atoms | 82.0µs | 468.0µs | 🟢 5.7x faster |
| get 1000 atoms | 15.7µs | 207.2µs | 🟢 13.6x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 55ns | 66ns | 🟢 1.2x faster |
| set + read 10 selectors | 7.1µs | 14.0µs | 🟢 2.0x faster |
| set + read 100 selectors | 74.3µs | 130.7µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 4.1µs | 7.1µs | 🟢 1.8x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 135.9µs | 287.6µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 100.9µs | 282.4µs | 🟢 2.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 849.4µs | 1.35ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 1.04ms | 1.79ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.34ms | 12.62ms | 🟢 9.4x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 7ns | 🔴 4.1x slower |

#### Other

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 92.3µs | 59.1µs | 🟡 1.6x slower |
| sub+unsub on chain of 100 unsubscribed derived deps | 174.2µs | 111.3µs | 🟡 1.6x slower |
| sub+unsub on chain of 500 unsubscribed derived deps | 796.0µs | 531.1µs | 🟡 1.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 180ns | 548ns | 🟢 3.0x faster |
| sub + unsub | 888ns | 1.4µs | 🟢 1.6x faster |
| atomFamily(id) | 124ns | 212ns | 🟢 1.6x faster |
| selectorFamily(id) | 128ns | 185ns | 🟢 1.4x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 9ns |
| valdres get | 17ns |
| jotai get | 199ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 204ns |
| jotai set | 1.4µs |
