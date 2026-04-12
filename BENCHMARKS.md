# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-12

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 55ns | 🟢 22.4x faster |
| store.get(atom) | 40ns | 380ns | 🟢 9.5x faster |
| set(atom, value) | 180ns | 2.1µs | 🟢 11.7x faster |
| set(atom, curr => curr+1) | 201ns | 2.7µs | 🟢 13.5x faster |
| set(atom) with 10 subs | 185ns | 3.8µs | 🟢 20.4x faster |
| atom lifecycle (create+100get+100set) | 15.2µs | 282.1µs | 🟢 18.6x faster |
| set 1000 atoms | 69.8µs | 1.14ms | 🟢 16.4x faster |
| get 1000 atoms | 7.2µs | 547.2µs | 🟢 76.3x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 62ns | 🟢 9.8x faster |
| set + read 10 selectors | 8.4µs | 30.7µs | 🟢 3.7x faster |
| set + read 100 selectors | 72.9µs | 333.5µs | 🟢 4.6x faster |
| set + read through 5 chained selectors | 7.5µs | 17.9µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 76.6µs | 302.9µs | 🟢 4.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 136.2µs | 598.2µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 741.9µs | 3.43ms | 🟢 4.6x faster |
| txn: cross-atom 1000 selectors, set + read | 886.9µs | 4.79ms | 🟢 5.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.41ms | 25.18ms | 🟢 17.9x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 53ns | 11ns | 🔴 4.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 368ns | 508ns | 🟢 1.4x faster |
| selectorFamily(id) | 373ns | 497ns | 🟢 1.3x faster |
| createStore | 662ns | 6.7µs | 🟢 10.2x faster |
| sub + unsub | 530ns | 2.4µs | 🟢 4.5x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 356ns |
| obj.value = n | 5ns |
| map.set(key, n) | 17ns |
| valdres set | 184ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 26ns | 48ns | 🟢 1.9x faster |
| store.get(atom) | 13ns | 161ns | 🟢 12.6x faster |
| set(atom, value) | 280ns | 1.2µs | 🟢 4.3x faster |
| set(atom, curr => curr+1) | 295ns | 1.5µs | 🟢 4.9x faster |
| set(atom) with 10 subs | 314ns | 1.7µs | 🟢 5.6x faster |
| atom lifecycle (create+100get+100set) | 31.3µs | 139.8µs | 🟢 4.5x faster |
| set 1000 atoms | 93.3µs | 420.2µs | 🟢 4.5x faster |
| get 1000 atoms | 13.8µs | 206.9µs | 🟢 15.0x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 52ns | 🟢 1.2x faster |
| set + read 10 selectors | 8.1µs | 20.6µs | 🟢 2.5x faster |
| set + read 100 selectors | 70.3µs | 126.5µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.7µs | 10.3µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 67.7µs | 140.6µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 73.4µs | 239.7µs | 🟢 3.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 778.8µs | 1.35ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 965.2µs | 1.94ms | 🟢 2.0x faster |
| txn: cross-atom 1000 selectors, with subs | 989.6µs | 13.68ms | 🟢 13.8x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 23ns | 7ns | 🔴 3.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 157ns | 1.4µs | 🟢 8.9x faster |
| sub + unsub | 686ns | 2.2µs | 🟢 3.2x faster |
| atomFamily(id) | 496ns | 574ns | 🟢 1.2x faster |
| selectorFamily(id) | 435ns | 414ns | 🟡 1.1x slower |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 13ns |
| jotai get | 205ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 286ns |
| jotai set | 1.4µs |
