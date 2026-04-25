# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-25

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 51ns | 🟢 22.0x faster |
| store.get(atom) | 40ns | 371ns | 🟢 9.3x faster |
| set(atom, value) | 180ns | 2.0µs | 🟢 11.4x faster |
| set(atom, curr => curr+1) | 150ns | 2.5µs | 🟢 16.9x faster |
| set(atom) with 10 subs | 189ns | 3.4µs | 🟢 17.9x faster |
| atom lifecycle (create+100get+100set) | 16.9µs | 264.7µs | 🟢 15.7x faster |
| set 1000 atoms | 75.8µs | 1.15ms | 🟢 15.1x faster |
| get 1000 atoms | 6.7µs | 518.6µs | 🟢 77.3x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 58ns | 🟢 11.7x faster |
| set + read 10 selectors | 8.3µs | 29.4µs | 🟢 3.5x faster |
| set + read 100 selectors | 75.9µs | 315.1µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 7.4µs | 17.3µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 81.8µs | 290.5µs | 🟢 3.6x faster |
| txn: 10 atoms × 10 selectors, with subs | 136.8µs | 604.3µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 772.2µs | 3.20ms | 🟢 4.1x faster |
| txn: cross-atom 1000 selectors, set + read | 909.7µs | 4.59ms | 🟢 5.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.40ms | 23.93ms | 🟢 17.1x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 27ns | 11ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 281ns | 445ns | 🟢 1.6x faster |
| selectorFamily(id) | 304ns | 439ns | 🟢 1.4x faster |
| createStore | 601ns | 6.6µs | 🟢 10.9x faster |
| sub + unsub | 511ns | 2.5µs | 🟢 4.8x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 346ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 189ns |
| jotai set | 3.1µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 48ns | 🟢 2.0x faster |
| store.get(atom) | 12ns | 158ns | 🟢 13.5x faster |
| set(atom, value) | 267ns | 1.2µs | 🟢 4.6x faster |
| set(atom, curr => curr+1) | 266ns | 1.4µs | 🟢 5.4x faster |
| set(atom) with 10 subs | 301ns | 1.7µs | 🟢 5.7x faster |
| atom lifecycle (create+100get+100set) | 32.2µs | 140.6µs | 🟢 4.4x faster |
| set 1000 atoms | 80.2µs | 450.5µs | 🟢 5.6x faster |
| get 1000 atoms | 14.5µs | 206.3µs | 🟢 14.2x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 41ns | 52ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.7µs | 19.1µs | 🟢 2.2x faster |
| set + read 100 selectors | 77.7µs | 127.8µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 4.9µs | 9.6µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 77.1µs | 139.1µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 77.6µs | 239.3µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 816.5µs | 1.33ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 1.02ms | 1.81ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 965.6µs | 12.21ms | 🟢 12.6x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 26ns | 7ns | 🔴 3.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 160ns | 1.2µs | 🟢 7.6x faster |
| sub + unsub | 801ns | 2.1µs | 🟢 2.6x faster |
| atomFamily(id) | 382ns | 463ns | 🟢 1.2x faster |
| selectorFamily(id) | 280ns | 355ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 197ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 261ns |
| jotai set | 1.4µs |
