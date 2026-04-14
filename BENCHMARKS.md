# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-14

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 4ns | 64ns | 🟢 15.9x faster |
| store.get(atom) | 26ns | 359ns | 🟢 13.8x faster |
| set(atom, value) | 163ns | 2.2µs | 🟢 13.4x faster |
| set(atom, curr => curr+1) | 194ns | 2.7µs | 🟢 13.8x faster |
| set(atom) with 10 subs | 193ns | 3.7µs | 🟢 19.0x faster |
| atom lifecycle (create+100get+100set) | 16.6µs | 282.7µs | 🟢 17.0x faster |
| set 1000 atoms | 69.1µs | 1.16ms | 🟢 16.8x faster |
| get 1000 atoms | 3.8µs | 492.6µs | 🟢 128.1x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 9ns | 87ns | 🟢 10.1x faster |
| set + read 10 selectors | 7.9µs | 28.3µs | 🟢 3.6x faster |
| set + read 100 selectors | 74.0µs | 302.4µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 7.4µs | 16.9µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 76.7µs | 288.3µs | 🟢 3.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 129.4µs | 573.6µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 741.7µs | 3.20ms | 🟢 4.3x faster |
| txn: cross-atom 1000 selectors, set + read | 879.7µs | 4.59ms | 🟢 5.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.44ms | 24.36ms | 🟢 16.9x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 44ns | 11ns | 🔴 4.0x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 317ns | 431ns | 🟢 1.4x faster |
| selectorFamily(id) | 325ns | 416ns | 🟢 1.3x faster |
| createStore | 557ns | 7.3µs | 🟢 13.1x faster |
| sub + unsub | 483ns | 2.6µs | 🟢 5.4x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 14ns |
| valdres get | 8ns |
| jotai get | 330ns |
| obj.value = n | 4ns |
| map.set(key, n) | 15ns |
| valdres set | 184ns |
| jotai set | 3.0µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 25ns | 45ns | 🟢 1.8x faster |
| store.get(atom) | 11ns | 158ns | 🟢 14.9x faster |
| set(atom, value) | 252ns | 1.3µs | 🟢 5.2x faster |
| set(atom, curr => curr+1) | 268ns | 1.5µs | 🟢 5.5x faster |
| set(atom) with 10 subs | 286ns | 1.8µs | 🟢 6.3x faster |
| atom lifecycle (create+100get+100set) | 28.7µs | 139.6µs | 🟢 4.9x faster |
| set 1000 atoms | 83.7µs | 445.0µs | 🟢 5.3x faster |
| get 1000 atoms | 13.2µs | 182.5µs | 🟢 13.9x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 41ns | 54ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.1µs | 22.6µs | 🟢 2.8x faster |
| set + read 100 selectors | 71.3µs | 142.5µs | 🟢 2.0x faster |
| set + read through 5 chained selectors | 4.6µs | 10.5µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 76.2µs | 152.7µs | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 74.4µs | 255.2µs | 🟢 3.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 780.1µs | 1.61ms | 🟢 2.1x faster |
| txn: cross-atom 1000 selectors, set + read | 984.6µs | 2.00ms | 🟢 2.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.02ms | 13.12ms | 🟢 12.8x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 19ns | 6ns | 🔴 3.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 266ns | 1.5µs | 🟢 5.7x faster |
| sub + unsub | 827ns | 2.2µs | 🟢 2.7x faster |
| atomFamily(id) | 390ns | 478ns | 🟢 1.2x faster |
| selectorFamily(id) | 291ns | 380ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 5ns |
| valdres get | 11ns |
| jotai get | 182ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 251ns |
| jotai set | 1.4µs |
