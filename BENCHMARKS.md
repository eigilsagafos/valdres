# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-22

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 53ns | 🟢 22.0x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 180ns | 2.1µs | 🟢 11.5x faster |
| set(atom, curr => curr+1) | 175ns | 2.6µs | 🟢 15.1x faster |
| set(atom) with 10 subs | 191ns | 3.5µs | 🟢 18.2x faster |
| atom lifecycle (create+100get+100set) | 15.5µs | 277.3µs | 🟢 17.9x faster |
| set 1000 atoms | 72.4µs | 1.16ms | 🟢 16.0x faster |
| get 1000 atoms | 4.1µs | 368.7µs | 🟢 89.3x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 63ns | 🟢 10.8x faster |
| set + read 10 selectors | 8.3µs | 30.4µs | 🟢 3.6x faster |
| set + read 100 selectors | 76.2µs | 340.2µs | 🟢 4.5x faster |
| set + read through 5 chained selectors | 7.6µs | 17.9µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 78.2µs | 403.4µs | 🟢 5.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 140.7µs | 680.3µs | 🟢 4.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 761.4µs | 4.69ms | 🟢 6.2x faster |
| txn: cross-atom 1000 selectors, set + read | 908.4µs | 4.89ms | 🟢 5.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.42ms | 25.19ms | 🟢 17.7x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 30ns | 11ns | 🔴 2.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 349ns | 509ns | 🟢 1.5x faster |
| selectorFamily(id) | 362ns | 505ns | 🟢 1.4x faster |
| createStore | 664ns | 6.7µs | 🟢 10.1x faster |
| sub + unsub | 481ns | 2.3µs | 🟢 4.9x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 357ns |
| obj.value = n | 5ns |
| map.set(key, n) | 16ns |
| valdres set | 189ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 26ns | 48ns | 🟢 1.8x faster |
| store.get(atom) | 13ns | 160ns | 🟢 12.6x faster |
| set(atom, value) | 262ns | 1.2µs | 🟢 4.6x faster |
| set(atom, curr => curr+1) | 279ns | 1.5µs | 🟢 5.3x faster |
| set(atom) with 10 subs | 299ns | 1.7µs | 🟢 5.8x faster |
| atom lifecycle (create+100get+100set) | 30.4µs | 136.7µs | 🟢 4.5x faster |
| set 1000 atoms | 96.0µs | 422.7µs | 🟢 4.4x faster |
| get 1000 atoms | 13.9µs | 206.1µs | 🟢 14.9x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 42ns | 52ns | 🟢 1.2x faster |
| set + read 10 selectors | 7.9µs | 19.5µs | 🟢 2.5x faster |
| set + read 100 selectors | 69.0µs | 129.2µs | 🟢 1.9x faster |
| set + read through 5 chained selectors | 4.5µs | 9.8µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 70.4µs | 138.7µs | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 69.1µs | 237.1µs | 🟢 3.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 759.2µs | 1.33ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, set + read | 954.4µs | 1.91ms | 🟢 2.0x faster |
| txn: cross-atom 1000 selectors, with subs | 921.4µs | 12.56ms | 🟢 13.6x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 22ns | 7ns | 🔴 3.3x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 155ns | 1.2µs | 🟢 7.7x faster |
| sub + unsub | 696ns | 2.1µs | 🟢 3.0x faster |
| atomFamily(id) | 442ns | 539ns | 🟢 1.2x faster |
| selectorFamily(id) | 353ns | 400ns | 🟢 1.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 13ns |
| jotai get | 203ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 275ns |
| jotai set | 1.3µs |
