# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-22

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 6ns | 58ns | 🟢 9.5x faster |
| store.get(atom) | 13ns | 341ns | 🟢 26.4x faster |
| set(atom, value) | 155ns | 2.7µs | 🟢 16.2x faster |
| set(atom, curr => curr+1) | 247ns | 5.6µs | 🟢 22.3x faster |
| set(atom) with 10 subs | 211ns | 3.7µs | 🟢 17.0x faster |
| atom lifecycle (create+100get+100set) | 12.4µs | 268.9µs | 🟢 21.6x faster |
| set 1000 atoms | 104.2µs | 998.9µs | 🟢 9.4x faster |
| get 1000 atoms | 8.1µs | 359.1µs | 🟢 44.2x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 62ns | 🟢 9.1x faster |
| set + read 10 selectors | 8.8µs | 40.0µs | 🟢 4.3x faster |
| set + read 100 selectors | 66.8µs | 384.4µs | 🟢 5.5x faster |
| set + read through 5 chained selectors | 7.0µs | 19.0µs | 🟢 2.7x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 76.4µs | 394.9µs | 🟢 5.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 140.3µs | 665.3µs | 🟢 4.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 943.4µs | 3.76ms | 🟢 4.0x faster |
| txn: cross-atom 1000 selectors, set + read | 861.9µs | 3.78ms | 🟢 4.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.63ms | 22.33ms | 🟢 14.3x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 30ns | 12ns | 🔴 2.5x slower |

#### Other

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 72.3µs | 114.6µs | 🟢 1.6x faster |
| sub+unsub on chain of 100 unsubscribed derived deps | 149.0µs | 165.2µs | 🟢 1.2x faster |
| sub+unsub on chain of 500 unsubscribed derived deps | 978.8µs | 1.13ms | 🟢 1.1x faster |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 338ns | 461ns | 🟢 1.4x faster |
| selectorFamily(id) | 301ns | 399ns | 🟢 1.3x faster |
| createStore | 230ns | 6.0µs | 🟢 26.3x faster |
| sub + unsub | 1.3µs | 3.7µs | 🟢 2.9x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 11ns |
| jotai get | 350ns |
| obj.value = n | 5ns |
| map.set(key, n) | 17ns |
| valdres set | 145ns |
| jotai set | 3.1µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 27ns | 56ns | 🟢 1.9x faster |
| store.get(atom) | 23ns | 169ns | 🟢 7.5x faster |
| set(atom, value) | 222ns | 1.3µs | 🟢 6.1x faster |
| set(atom, curr => curr+1) | 213ns | 1.5µs | 🟢 7.3x faster |
| set(atom) with 10 subs | 259ns | 1.8µs | 🟢 6.8x faster |
| atom lifecycle (create+100get+100set) | 23.2µs | 148.4µs | 🟢 6.5x faster |
| set 1000 atoms | 83.7µs | 470.0µs | 🟢 5.6x faster |
| get 1000 atoms | 16.1µs | 207.6µs | 🟢 13.3x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 57ns | 🟢 1.3x faster |
| set + read 10 selectors | 7.5µs | 14.6µs | 🟢 1.9x faster |
| set + read 100 selectors | 77.2µs | 135.7µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.5µs | 7.4µs | 🟢 1.6x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 139.7µs | 292.2µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 103.7µs | 284.5µs | 🟢 2.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 857.9µs | 1.39ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 1.07ms | 1.85ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.30ms | 12.53ms | 🟢 9.4x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 7ns | 🔴 4.2x slower |

#### Other

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 102.5µs | 60.8µs | 🟡 1.7x slower |
| sub+unsub on chain of 100 unsubscribed derived deps | 194.8µs | 112.4µs | 🟡 1.7x slower |
| sub+unsub on chain of 500 unsubscribed derived deps | 919.8µs | 548.7µs | 🟡 1.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 164ns | 510ns | 🟢 3.1x faster |
| sub + unsub | 872ns | 1.5µs | 🟢 1.7x faster |
| atomFamily(id) | 179ns | 214ns | 🟢 1.3x faster |
| selectorFamily(id) | 136ns | 187ns | 🟢 1.4x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 24ns |
| valdres get | 17ns |
| jotai get | 200ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 195ns |
| jotai set | 1.4µs |
