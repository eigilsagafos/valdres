# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-27

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 8ns | 67ns | 🟢 8.9x faster |
| store.get(atom) | 14ns | 353ns | 🟢 25.6x faster |
| set(atom, value) | 217ns | 4.6µs | 🟢 21.3x faster |
| set(atom, curr => curr+1) | 103ns | 3.0µs | 🟢 28.2x faster |
| set(atom) with 10 subs | 147ns | 3.5µs | 🟢 23.7x faster |
| atom lifecycle (create+100get+100set) | 11.2µs | 282.0µs | 🟢 25.2x faster |
| set 1000 atoms | 80.9µs | 914.0µs | 🟢 11.5x faster |
| get 1000 atoms | 8.3µs | 374.5µs | 🟢 45.5x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 10ns | 70ns | 🟢 7.5x faster |
| set + read 10 selectors | 6.7µs | 38.1µs | 🟢 5.3x faster |
| set + read 100 selectors | 61.9µs | 270.7µs | 🟢 4.4x faster |
| set + read through 5 chained selectors | 6.3µs | 18.1µs | 🟢 2.9x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 71.1µs | 390.0µs | 🟢 5.3x faster |
| txn: 10 atoms × 10 selectors, with subs | 132.0µs | 550.3µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 984.9µs | 3.89ms | 🟢 4.1x faster |
| txn: cross-atom 1000 selectors, set + read | 885.5µs | 3.84ms | 🟢 4.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.79ms | 23.19ms | 🟢 14.3x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 33ns | 12ns | 🔴 2.6x slower |

#### Other

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 71.6µs | 103.5µs | 🟢 1.4x faster |
| sub+unsub on chain of 100 unsubscribed derived deps | 129.1µs | 157.5µs | 🟢 1.2x faster |
| sub+unsub on chain of 500 unsubscribed derived deps | 625.4µs | 680.0µs | 🟢 1.1x faster |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 348ns | 480ns | 🟢 1.4x faster |
| selectorFamily(id) | 343ns | 454ns | 🟢 1.3x faster |
| createStore | 319ns | 6.1µs | 🟢 19.0x faster |
| sub + unsub | 1.5µs | 3.9µs | 🟢 2.7x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 11ns |
| jotai get | 363ns |
| obj.value = n | 6ns |
| map.set(key, n) | 17ns |
| valdres set | 126ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 29ns | 55ns | 🟢 1.7x faster |
| store.get(atom) | 23ns | 165ns | 🟢 7.2x faster |
| set(atom, value) | 223ns | 1.2µs | 🟢 5.6x faster |
| set(atom, curr => curr+1) | 217ns | 1.5µs | 🟢 6.8x faster |
| set(atom) with 10 subs | 257ns | 1.7µs | 🟢 6.8x faster |
| atom lifecycle (create+100get+100set) | 24.8µs | 139.3µs | 🟢 5.7x faster |
| set 1000 atoms | 85.6µs | 439.2µs | 🟢 5.1x faster |
| get 1000 atoms | 14.3µs | 206.4µs | 🟢 14.5x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 48ns | 58ns | 🟢 1.2x faster |
| set + read 10 selectors | 6.5µs | 14.5µs | 🟢 2.2x faster |
| set + read 100 selectors | 67.4µs | 130.6µs | 🟢 1.9x faster |
| set + read through 5 chained selectors | 4.0µs | 7.4µs | 🟢 1.9x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 131.8µs | 330.7µs | 🟢 2.5x faster |
| txn: 10 atoms × 10 selectors, with subs | 93.0µs | 274.2µs | 🟢 2.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 823.9µs | 1.37ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 1.02ms | 1.86ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.33ms | 13.27ms | 🟢 9.0x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 31ns | 11ns | 🔴 2.4x slower |

#### Other

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 88.2µs | 56.7µs | 🟡 1.5x slower |
| sub+unsub on chain of 100 unsubscribed derived deps | 177.1µs | 110.4µs | 🟡 1.6x slower |
| sub+unsub on chain of 500 unsubscribed derived deps | 777.4µs | 521.2µs | 🟡 1.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 192ns | 532ns | 🟢 2.7x faster |
| sub + unsub | 786ns | 1.4µs | 🟢 1.8x faster |
| atomFamily(id) | 227ns | 216ns | 🟢 1.1x faster |
| selectorFamily(id) | 175ns | 192ns | 🟢 1.1x faster |

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
| valdres set | 210ns |
| jotai set | 1.4µs |
