# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 51ns | 🟢 21.8x faster |
| store.get(atom) | 40ns | 361ns | 🟢 9.0x faster |
| set(atom, value) | 171ns | 2.1µs | 🟢 12.5x faster |
| set(atom, curr => curr+1) | 210ns | 2.7µs | 🟢 12.7x faster |
| set(atom) with 10 subs | 214ns | 3.5µs | 🟢 16.5x faster |
| atom lifecycle (create+100get+100set) | 15.9µs | 278.4µs | 🟢 17.5x faster |
| set 1000 atoms | 74.5µs | 1.17ms | 🟢 15.7x faster |
| get 1000 atoms | 6.6µs | 524.3µs | 🟢 79.1x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 71ns | 🟢 13.5x faster |
| set + read 10 selectors | 8.6µs | 30.4µs | 🟢 3.5x faster |
| set + read 100 selectors | 82.8µs | 337.7µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 8.4µs | 18.4µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 84.5µs | 314.2µs | 🟢 3.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 110.7µs | 653.1µs | 🟢 5.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 756.7µs | 3.39ms | 🟢 4.5x faster |
| txn: cross-atom 1000 selectors, set + read | 892.8µs | 4.83ms | 🟢 5.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.16ms | 27.09ms | 🟢 23.4x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 10ns | 4ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 200ns | 464ns | 🟢 2.3x faster |
| selectorFamily(id) | 342ns | 463ns | 🟢 1.4x faster |
| createStore | 641ns | 6.7µs | 🟢 10.4x faster |
| sub + unsub | 491ns | 2.6µs | 🟢 5.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 345ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 193ns |
| jotai set | 3.2µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 25ns | 49ns | 🟢 2.0x faster |
| store.get(atom) | 12ns | 164ns | 🟢 14.0x faster |
| set(atom, value) | 277ns | 1.3µs | 🟢 4.7x faster |
| set(atom, curr => curr+1) | 306ns | 1.5µs | 🟢 5.0x faster |
| set(atom) with 10 subs | 324ns | 1.7µs | 🟢 5.4x faster |
| atom lifecycle (create+100get+100set) | 31.0µs | 146.6µs | 🟢 4.7x faster |
| set 1000 atoms | 100.7µs | 458.7µs | 🟢 4.6x faster |
| get 1000 atoms | 14.6µs | 208.1µs | 🟢 14.3x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 54ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.8µs | 20.1µs | 🟢 2.3x faster |
| set + read 100 selectors | 78.2µs | 130.2µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 5.0µs | 10.2µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 79.4µs | 145.4µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 79.5µs | 244.0µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 863.2µs | 1.36ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 1.05ms | 1.83ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.07ms | 13.27ms | 🟢 12.4x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 26ns | 7ns | 🔴 3.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 159ns | 1.5µs | 🟢 9.1x faster |
| sub + unsub | 792ns | 2.2µs | 🟢 2.8x faster |
| atomFamily(id) | 482ns | 554ns | 🟢 1.1x faster |
| selectorFamily(id) | 298ns | 392ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 198ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 272ns |
| jotai set | 1.4µs |
