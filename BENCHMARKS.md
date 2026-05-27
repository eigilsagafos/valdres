# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-27

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 5ns | 60ns | 🟢 12.2x faster |
| store.get(atom) | 13ns | 343ns | 🟢 26.9x faster |
| set(atom, value) | 223ns | 4.3µs | 🟢 19.7x faster |
| set(atom, curr => curr+1) | 104ns | 2.8µs | 🟢 26.7x faster |
| set(atom) with 10 subs | 160ns | 3.2µs | 🟢 20.9x faster |
| atom lifecycle (create+100get+100set) | 11.0µs | 260.4µs | 🟢 23.7x faster |
| set 1000 atoms | 82.7µs | 954.5µs | 🟢 11.7x faster |
| get 1000 atoms | 8.7µs | 429.1µs | 🟢 53.2x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 64ns | 🟢 10.0x faster |
| set + read 10 selectors | 7.2µs | 39.1µs | 🟢 5.1x faster |
| set + read 100 selectors | 66.6µs | 377.8µs | 🟢 5.6x faster |
| set + read through 5 chained selectors | 7.7µs | 17.9µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 73.2µs | 384.4µs | 🟢 5.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 130.8µs | 655.0µs | 🟢 5.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 935.3µs | 3.58ms | 🟢 3.8x faster |
| txn: cross-atom 1000 selectors, set + read | 883.4µs | 5.26ms | 🟢 6.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.45ms | 25.49ms | 🟢 16.3x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 29ns | 11ns | 🔴 2.5x slower |

#### Other

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 72.6µs | 114.9µs | 🟢 1.6x faster |
| sub+unsub on chain of 100 unsubscribed derived deps | 207.0µs | 225.3µs | 🟢 1.2x faster |
| sub+unsub on chain of 500 unsubscribed derived deps | 621.0µs | 643.1µs | 🟢 1.0x faster |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 260ns | 416ns | 🟢 1.6x faster |
| selectorFamily(id) | 276ns | 390ns | 🟢 1.4x faster |
| createStore | 284ns | 5.9µs | 🟢 20.8x faster |
| sub + unsub | 1.2µs | 3.8µs | 🟢 3.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 12ns |
| jotai get | 352ns |
| obj.value = n | 5ns |
| map.set(key, n) | 17ns |
| valdres set | 124ns |
| jotai set | 2.7µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 26ns | 52ns | 🟢 1.9x faster |
| store.get(atom) | 24ns | 167ns | 🟢 7.3x faster |
| set(atom, value) | 261ns | 1.3µs | 🟢 4.9x faster |
| set(atom, curr => curr+1) | 239ns | 1.5µs | 🟢 6.2x faster |
| set(atom) with 10 subs | 274ns | 1.7µs | 🟢 6.3x faster |
| atom lifecycle (create+100get+100set) | 25.1µs | 142.4µs | 🟢 5.7x faster |
| set 1000 atoms | 80.9µs | 468.0µs | 🟢 5.8x faster |
| get 1000 atoms | 15.8µs | 207.4µs | 🟢 13.6x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 42ns | 63ns | 🟢 1.4x faster |
| set + read 10 selectors | 7.3µs | 14.3µs | 🟢 2.0x faster |
| set + read 100 selectors | 73.6µs | 130.9µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.0µs | 7.2µs | 🟢 1.8x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 135.8µs | 290.6µs | 🟢 2.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 103.0µs | 274.2µs | 🟢 2.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 897.2µs | 1.37ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.06ms | 1.83ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.27ms | 12.34ms | 🟢 9.0x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 27ns | 7ns | 🔴 3.5x slower |

#### Other

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 91.4µs | 59.9µs | 🟡 1.5x slower |
| sub+unsub on chain of 100 unsubscribed derived deps | 170.8µs | 110.6µs | 🟡 1.5x slower |
| sub+unsub on chain of 500 unsubscribed derived deps | 781.2µs | 533.9µs | 🟡 1.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 190ns | 488ns | 🟢 2.6x faster |
| sub + unsub | 874ns | 1.4µs | 🟢 1.6x faster |
| atomFamily(id) | 165ns | 233ns | 🟢 1.4x faster |
| selectorFamily(id) | 124ns | 194ns | 🟢 1.5x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 24ns |
| valdres get | 17ns |
| jotai get | 199ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 207ns |
| jotai set | 1.4µs |
