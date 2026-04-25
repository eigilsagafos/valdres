# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-25

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 56ns | 🟢 23.0x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 180ns | 2.1µs | 🟢 11.7x faster |
| set(atom, curr => curr+1) | 154ns | 2.7µs | 🟢 17.4x faster |
| set(atom) with 10 subs | 189ns | 3.7µs | 🟢 19.5x faster |
| atom lifecycle (create+100get+100set) | 17.3µs | 281.7µs | 🟢 16.3x faster |
| set 1000 atoms | 72.2µs | 1.15ms | 🟢 15.9x faster |
| get 1000 atoms | 4.0µs | 369.3µs | 🟢 92.0x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 7ns | 63ns | 🟢 9.3x faster |
| set + read 10 selectors | 8.5µs | 31.3µs | 🟢 3.7x faster |
| set + read 100 selectors | 77.6µs | 334.4µs | 🟢 4.3x faster |
| set + read through 5 chained selectors | 7.6µs | 18.1µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 77.7µs | 399.1µs | 🟢 5.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 137.6µs | 672.8µs | 🟢 4.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 764.7µs | 4.66ms | 🟢 6.1x faster |
| txn: cross-atom 1000 selectors, set + read | 932.8µs | 4.85ms | 🟢 5.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.41ms | 25.22ms | 🟢 17.8x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 31ns | 11ns | 🔴 2.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 398ns | 545ns | 🟢 1.4x faster |
| selectorFamily(id) | 415ns | 545ns | 🟢 1.3x faster |
| createStore | 661ns | 6.7µs | 🟢 10.2x faster |
| sub + unsub | 461ns | 2.4µs | 🟢 5.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 358ns |
| obj.value = n | 5ns |
| map.set(key, n) | 17ns |
| valdres set | 188ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 27ns | 51ns | 🟢 1.9x faster |
| store.get(atom) | 13ns | 161ns | 🟢 12.6x faster |
| set(atom, value) | 240ns | 1.2µs | 🟢 5.0x faster |
| set(atom, curr => curr+1) | 249ns | 1.5µs | 🟢 6.0x faster |
| set(atom) with 10 subs | 288ns | 1.8µs | 🟢 6.1x faster |
| atom lifecycle (create+100get+100set) | 29.6µs | 137.1µs | 🟢 4.6x faster |
| set 1000 atoms | 80.4µs | 420.0µs | 🟢 5.2x faster |
| get 1000 atoms | 13.8µs | 204.8µs | 🟢 14.9x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 46ns | 56ns | 🟢 1.2x faster |
| set + read 10 selectors | 8.1µs | 20.3µs | 🟢 2.5x faster |
| set + read 100 selectors | 69.0µs | 129.5µs | 🟢 1.9x faster |
| set + read through 5 chained selectors | 4.7µs | 10.3µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 70.8µs | 136.9µs | 🟢 1.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 73.8µs | 242.5µs | 🟢 3.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 785.7µs | 1.39ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, set + read | 986.9µs | 1.91ms | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 924.6µs | 13.59ms | 🟢 14.7x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 23ns | 7ns | 🔴 3.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 159ns | 1.4µs | 🟢 8.8x faster |
| sub + unsub | 706ns | 2.2µs | 🟢 3.1x faster |
| atomFamily(id) | 540ns | 596ns | 🟢 1.1x faster |
| selectorFamily(id) | 424ns | 448ns | 🟢 1.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 13ns |
| jotai get | 202ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 258ns |
| jotai set | 1.3µs |
