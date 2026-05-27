# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-27

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 4ns | 56ns | 🟢 11.0x faster |
| store.get(atom) | 13ns | 372ns | 🟢 28.4x faster |
| set(atom, value) | 256ns | 4.7µs | 🟢 18.6x faster |
| set(atom, curr => curr+1) | 110ns | 3.0µs | 🟢 26.2x faster |
| set(atom) with 10 subs | 155ns | 3.4µs | 🟢 21.4x faster |
| atom lifecycle (create+100get+100set) | 11.2µs | 259.2µs | 🟢 23.4x faster |
| set 1000 atoms | 82.3µs | 953.6µs | 🟢 11.7x faster |
| get 1000 atoms | 7.9µs | 358.4µs | 🟢 44.6x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 65ns | 🟢 10.3x faster |
| set + read 10 selectors | 7.0µs | 38.6µs | 🟢 5.3x faster |
| set + read 100 selectors | 66.3µs | 360.3µs | 🟢 5.0x faster |
| set + read through 5 chained selectors | 6.8µs | 18.0µs | 🟢 2.7x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 73.5µs | 405.5µs | 🟢 5.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 140.1µs | 661.0µs | 🟢 4.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 907.1µs | 3.68ms | 🟢 4.1x faster |
| txn: cross-atom 1000 selectors, set + read | 853.2µs | 3.86ms | 🟢 4.6x faster |
| txn: cross-atom 1000 selectors, with subs | 1.43ms | 22.25ms | 🟢 15.5x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 29ns | 11ns | 🔴 2.5x slower |

#### Other

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 69.8µs | 113.3µs | 🟢 1.6x faster |
| sub+unsub on chain of 100 unsubscribed derived deps | 136.5µs | 166.4µs | 🟢 1.2x faster |
| sub+unsub on chain of 500 unsubscribed derived deps | 633.4µs | 667.1µs | 🟢 1.2x faster |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 289ns | 390ns | 🟢 1.4x faster |
| selectorFamily(id) | 271ns | 370ns | 🟢 1.4x faster |
| createStore | 278ns | 5.9µs | 🟢 21.5x faster |
| sub + unsub | 1.2µs | 3.6µs | 🟢 2.9x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 11ns |
| jotai get | 350ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 125ns |
| jotai set | 2.4µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 27ns | 55ns | 🟢 1.9x faster |
| store.get(atom) | 14ns | 159ns | 🟢 10.9x faster |
| set(atom, value) | 248ns | 1.2µs | 🟢 5.0x faster |
| set(atom, curr => curr+1) | 254ns | 1.4µs | 🟢 5.7x faster |
| set(atom) with 10 subs | 281ns | 1.7µs | 🟢 6.1x faster |
| atom lifecycle (create+100get+100set) | 26.8µs | 144.5µs | 🟢 5.4x faster |
| set 1000 atoms | 83.3µs | 468.5µs | 🟢 5.6x faster |
| get 1000 atoms | 15.6µs | 210.8µs | 🟢 13.8x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 56ns | 🟢 1.3x faster |
| set + read 10 selectors | 7.3µs | 14.2µs | 🟢 2.0x faster |
| set + read 100 selectors | 75.9µs | 131.3µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 4.5µs | 7.1µs | 🟢 1.6x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 139.2µs | 288.1µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 110.5µs | 285.8µs | 🟢 2.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 892.6µs | 1.37ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.07ms | 1.83ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.19ms | 12.88ms | 🟢 10.2x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 7ns | 🔴 4.2x slower |

#### Other

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 102.0µs | 58.6µs | 🟡 1.7x slower |
| sub+unsub on chain of 100 unsubscribed derived deps | 192.1µs | 109.6µs | 🟡 1.8x slower |
| sub+unsub on chain of 500 unsubscribed derived deps | 896.9µs | 520.1µs | 🟡 1.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 176ns | 562ns | 🟢 3.2x faster |
| sub + unsub | 870ns | 1.4µs | 🟢 1.6x faster |
| atomFamily(id) | 138ns | 211ns | 🟢 1.5x faster |
| selectorFamily(id) | 169ns | 211ns | 🟢 1.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 24ns |
| valdres get | 17ns |
| jotai get | 198ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 210ns |
| jotai set | 1.4µs |
