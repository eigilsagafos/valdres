# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-27

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 6ns | 58ns | 🟢 9.6x faster |
| store.get(atom) | 25ns | 679ns | 🟢 27.9x faster |
| set(atom, value) | 222ns | 4.3µs | 🟢 19.0x faster |
| set(atom, curr => curr+1) | 107ns | 3.0µs | 🟢 26.8x faster |
| set(atom) with 10 subs | 169ns | 3.9µs | 🟢 21.5x faster |
| atom lifecycle (create+100get+100set) | 11.6µs | 265.2µs | 🟢 22.9x faster |
| set 1000 atoms | 109.5µs | 977.7µs | 🟢 8.8x faster |
| get 1000 atoms | 8.5µs | 395.3µs | 🟢 46.1x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 10ns | 102ns | 🟢 7.9x faster |
| set + read 10 selectors | 12.5µs | 48.6µs | 🟢 3.9x faster |
| set + read 100 selectors | 70.5µs | 377.2µs | 🟢 5.1x faster |
| set + read 100 selectorFamily entries | 77.4µs | 377.6µs | 🟢 4.7x faster |
| set + read through 5 chained selectors | 7.2µs | 14.3µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 79.1µs | 264.9µs | 🟢 3.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 129.1µs | 511.8µs | 🟢 4.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 946.2µs | 3.36ms | 🟢 3.5x faster |
| txn: cross-atom 1000 selectors, set + read | 904.5µs | 3.56ms | 🟢 3.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.63ms | 18.63ms | 🟢 11.1x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 29ns | 11ns | 🔴 2.5x slower |

#### Other

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 114.5µs | 131.0µs | 🟢 1.2x faster |
| sub+unsub on chain of 100 unsubscribed derived deps | 202.4µs | 233.3µs | 🟢 1.2x faster |
| sub+unsub on chain of 500 unsubscribed derived deps | 570.9µs | 659.8µs | 🟢 1.2x faster |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 302ns | 428ns | 🟢 1.4x faster |
| selectorFamily(id) | 332ns | 341ns | 🟢 1.1x faster |
| createStore | 334ns | 6.0µs | 🟢 18.0x faster |
| sub + unsub | 1.2µs | 3.6µs | 🟢 3.0x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 9ns |
| jotai get | 354ns |
| obj.value = n | 5ns |
| map.set(key, n) | 17ns |
| valdres set | 122ns |
| jotai set | 2.4µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 32ns | 61ns | 🟢 1.7x faster |
| store.get(atom) | 14ns | 157ns | 🟢 10.9x faster |
| set(atom, value) | 222ns | 1.2µs | 🟢 5.7x faster |
| set(atom, curr => curr+1) | 232ns | 1.5µs | 🟢 6.4x faster |
| set(atom) with 10 subs | 258ns | 1.7µs | 🟢 6.7x faster |
| atom lifecycle (create+100get+100set) | 25.0µs | 143.3µs | 🟢 5.8x faster |
| set 1000 atoms | 81.6µs | 487.3µs | 🟢 6.0x faster |
| get 1000 atoms | 16.1µs | 207.3µs | 🟢 13.1x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 42ns | 57ns | 🟢 1.3x faster |
| set + read 10 selectors | 7.1µs | 14.3µs | 🟢 2.0x faster |
| set + read 100 selectors | 73.3µs | 133.4µs | 🟢 1.8x faster |
| set + read 100 selectorFamily entries | 76.0µs | 132.6µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 4.2µs | 7.2µs | 🟢 1.7x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 139.6µs | 288.3µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 110.5µs | 276.8µs | 🟢 2.6x faster |
| txn: 10 atoms × 100 selectors, set + read | 900.7µs | 1.41ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.04ms | 1.82ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.55ms | 13.08ms | 🟢 8.1x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 71ns | 32ns | 🔴 3.1x slower |

#### Other

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 92.5µs | 59.2µs | 🟡 1.6x slower |
| sub+unsub on chain of 100 unsubscribed derived deps | 174.3µs | 111.1µs | 🟡 1.6x slower |
| sub+unsub on chain of 500 unsubscribed derived deps | 784.1µs | 537.6µs | 🟡 1.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 196ns | 495ns | 🟢 2.5x faster |
| sub + unsub | 860ns | 1.4µs | 🟢 1.6x faster |
| atomFamily(id) | 137ns | 217ns | 🟢 1.5x faster |
| selectorFamily(id) | 164ns | 180ns | 🟢 1.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 25ns |
| valdres get | 17ns |
| jotai get | 198ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 217ns |
| jotai set | 1.4µs |
