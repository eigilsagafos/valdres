# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 57ns | 🟢 22.7x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 180ns | 2.1µs | 🟢 11.5x faster |
| set(atom, curr => curr+1) | 176ns | 2.7µs | 🟢 15.2x faster |
| set(atom) with 10 subs | 189ns | 3.6µs | 🟢 19.0x faster |
| atom lifecycle (create+100get+100set) | 15.4µs | 280.1µs | 🟢 18.2x faster |
| set 1000 atoms | 72.4µs | 1.15ms | 🟢 15.9x faster |
| get 1000 atoms | 7.1µs | 579.5µs | 🟢 81.6x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 63ns | 🟢 10.0x faster |
| set + read 10 selectors | 8.5µs | 30.5µs | 🟢 3.6x faster |
| set + read 100 selectors | 76.2µs | 333.3µs | 🟢 4.4x faster |
| set + read through 5 chained selectors | 7.8µs | 17.8µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 82.1µs | 307.9µs | 🟢 3.7x faster |
| txn: 10 atoms × 10 selectors, with subs | 107.7µs | 608.8µs | 🟢 5.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 736.3µs | 3.44ms | 🟢 4.7x faster |
| txn: cross-atom 1000 selectors, set + read | 885.2µs | 4.82ms | 🟢 5.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.12ms | 25.20ms | 🟢 22.4x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 54ns | 11ns | 🔴 4.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 370ns | 527ns | 🟢 1.4x faster |
| selectorFamily(id) | 384ns | 522ns | 🟢 1.4x faster |
| createStore | 668ns | 6.7µs | 🟢 10.1x faster |
| sub + unsub | 500ns | 2.4µs | 🟢 4.7x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 358ns |
| obj.value = n | 5ns |
| map.set(key, n) | 16ns |
| valdres set | 186ns |
| jotai set | 3.4µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 27ns | 49ns | 🟢 1.8x faster |
| store.get(atom) | 13ns | 161ns | 🟢 12.6x faster |
| set(atom, value) | 263ns | 1.2µs | 🟢 4.4x faster |
| set(atom, curr => curr+1) | 282ns | 1.5µs | 🟢 5.3x faster |
| set(atom) with 10 subs | 300ns | 1.7µs | 🟢 5.8x faster |
| atom lifecycle (create+100get+100set) | 29.9µs | 138.4µs | 🟢 4.6x faster |
| set 1000 atoms | 92.0µs | 421.0µs | 🟢 4.6x faster |
| get 1000 atoms | 13.8µs | 207.4µs | 🟢 15.0x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 44ns | 53ns | 🟢 1.2x faster |
| set + read 10 selectors | 8.0µs | 19.6µs | 🟢 2.5x faster |
| set + read 100 selectors | 67.6µs | 130.3µs | 🟢 1.9x faster |
| set + read through 5 chained selectors | 4.6µs | 9.8µs | 🟢 2.1x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 71.5µs | 136.8µs | 🟢 1.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 72.1µs | 239.5µs | 🟢 3.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 783.3µs | 1.31ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 974.6µs | 1.85ms | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 935.9µs | 12.32ms | 🟢 13.2x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 22ns | 7ns | 🔴 3.1x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 156ns | 1.2µs | 🟢 7.9x faster |
| sub + unsub | 707ns | 2.1µs | 🟢 2.9x faster |
| atomFamily(id) | 457ns | 554ns | 🟢 1.2x faster |
| selectorFamily(id) | 171ns | 414ns | 🟢 2.4x faster |

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
| valdres set | 284ns |
| jotai set | 1.4µs |
