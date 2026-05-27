# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-27

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 7ns | 64ns | 🟢 8.2x faster |
| store.get(atom) | 13ns | 375ns | 🟢 28.6x faster |
| set(atom, value) | 213ns | 5.0µs | 🟢 23.3x faster |
| set(atom, curr => curr+1) | 116ns | 3.2µs | 🟢 26.7x faster |
| set(atom) with 10 subs | 158ns | 3.6µs | 🟢 22.4x faster |
| atom lifecycle (create+100get+100set) | 11.9µs | 271.2µs | 🟢 22.5x faster |
| set 1000 atoms | 85.7µs | 960.5µs | 🟢 11.4x faster |
| get 1000 atoms | 8.1µs | 369.2µs | 🟢 46.1x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 11ns | 87ns | 🟢 7.7x faster |
| set + read 10 selectors | 6.7µs | 38.4µs | 🟢 5.5x faster |
| set + read 100 selectors | 61.6µs | 374.7µs | 🟢 6.0x faster |
| set + read through 5 chained selectors | 6.2µs | 18.0µs | 🟢 2.9x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 71.1µs | 403.0µs | 🟢 5.3x faster |
| txn: 10 atoms × 10 selectors, with subs | 134.7µs | 562.7µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 975.0µs | 3.95ms | 🟢 4.1x faster |
| txn: cross-atom 1000 selectors, set + read | 883.6µs | 5.13ms | 🟢 4.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.65ms | 24.12ms | 🟢 15.3x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 33ns | 13ns | 🔴 2.4x slower |

#### Other

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 74.5µs | 112.8µs | 🟢 1.5x faster |
| sub+unsub on chain of 100 unsubscribed derived deps | 131.1µs | 150.3µs | 🟢 1.2x faster |
| sub+unsub on chain of 500 unsubscribed derived deps | 1.07ms | 1.05ms | 🟢 1.2x faster |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 320ns | 429ns | 🟢 1.4x faster |
| selectorFamily(id) | 308ns | 412ns | 🟢 1.3x faster |
| createStore | 346ns | 6.4µs | 🟢 18.6x faster |
| sub + unsub | 1.5µs | 4.0µs | 🟢 2.8x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 12ns |
| jotai get | 365ns |
| obj.value = n | 5ns |
| map.set(key, n) | 17ns |
| valdres set | 129ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 28ns | 55ns | 🟢 1.8x faster |
| store.get(atom) | 23ns | 165ns | 🟢 7.1x faster |
| set(atom, value) | 226ns | 1.3µs | 🟢 5.7x faster |
| set(atom, curr => curr+1) | 224ns | 1.5µs | 🟢 6.7x faster |
| set(atom) with 10 subs | 253ns | 1.7µs | 🟢 7.0x faster |
| atom lifecycle (create+100get+100set) | 24.6µs | 141.6µs | 🟢 5.8x faster |
| set 1000 atoms | 83.8µs | 469.2µs | 🟢 5.6x faster |
| get 1000 atoms | 14.3µs | 207.1µs | 🟢 14.5x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 46ns | 58ns | 🟢 1.2x faster |
| set + read 10 selectors | 6.4µs | 14.2µs | 🟢 2.2x faster |
| set + read 100 selectors | 67.8µs | 130.8µs | 🟢 1.9x faster |
| set + read through 5 chained selectors | 3.9µs | 7.5µs | 🟢 1.9x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 131.3µs | 318.0µs | 🟢 2.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 92.5µs | 278.7µs | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 817.2µs | 1.37ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 1.02ms | 1.84ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.33ms | 13.07ms | 🟢 9.3x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 25ns | 10ns | 🔴 2.5x slower |

#### Other

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 89.2µs | 57.6µs | 🟡 1.6x slower |
| sub+unsub on chain of 100 unsubscribed derived deps | 169.4µs | 107.1µs | 🟡 1.6x slower |
| sub+unsub on chain of 500 unsubscribed derived deps | 773.3µs | 515.8µs | 🟡 1.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 197ns | 520ns | 🟢 2.6x faster |
| sub + unsub | 820ns | 1.4µs | 🟢 1.7x faster |
| atomFamily(id) | 171ns | 211ns | 🟢 1.2x faster |
| selectorFamily(id) | 128ns | 188ns | 🟢 1.4x faster |

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
| valdres set | 211ns |
| jotai set | 1.4µs |
