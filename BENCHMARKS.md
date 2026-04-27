# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-27

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 57ns | 🟢 22.8x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 180ns | 2.1µs | 🟢 11.7x faster |
| set(atom, curr => curr+1) | 148ns | 2.7µs | 🟢 18.4x faster |
| set(atom) with 10 subs | 188ns | 3.6µs | 🟢 19.1x faster |
| atom lifecycle (create+100get+100set) | 17.3µs | 282.6µs | 🟢 16.4x faster |
| set 1000 atoms | 71.7µs | 1.17ms | 🟢 16.3x faster |
| get 1000 atoms | 7.2µs | 561.0µs | 🟢 78.0x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 63ns | 🟢 10.0x faster |
| set + read 10 selectors | 8.5µs | 28.1µs | 🟢 3.3x faster |
| set + read 100 selectors | 75.5µs | 332.9µs | 🟢 4.4x faster |
| set + read through 5 chained selectors | 7.5µs | 18.0µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 77.1µs | 305.3µs | 🟢 4.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 138.9µs | 607.4µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 768.5µs | 3.50ms | 🟢 4.6x faster |
| txn: cross-atom 1000 selectors, set + read | 933.9µs | 4.86ms | 🟢 5.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.41ms | 26.72ms | 🟢 18.9x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 31ns | 11ns | 🔴 2.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 393ns | 531ns | 🟢 1.3x faster |
| selectorFamily(id) | 396ns | 540ns | 🟢 1.4x faster |
| createStore | 656ns | 6.7µs | 🟢 10.3x faster |
| sub + unsub | 481ns | 2.4µs | 🟢 5.0x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 12ns |
| jotai get | 357ns |
| obj.value = n | 5ns |
| map.set(key, n) | 17ns |
| valdres set | 180ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 27ns | 48ns | 🟢 1.8x faster |
| store.get(atom) | 14ns | 162ns | 🟢 11.6x faster |
| set(atom, value) | 256ns | 1.2µs | 🟢 4.6x faster |
| set(atom, curr => curr+1) | 255ns | 1.5µs | 🟢 5.7x faster |
| set(atom) with 10 subs | 302ns | 1.7µs | 🟢 5.7x faster |
| atom lifecycle (create+100get+100set) | 30.3µs | 138.0µs | 🟢 4.6x faster |
| set 1000 atoms | 79.2µs | 421.5µs | 🟢 5.3x faster |
| get 1000 atoms | 14.5µs | 204.6µs | 🟢 14.1x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 44ns | 52ns | 🟢 1.2x faster |
| set + read 10 selectors | 8.0µs | 20.7µs | 🟢 2.6x faster |
| set + read 100 selectors | 70.3µs | 129.2µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.6µs | 10.3µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 68.9µs | 136.1µs | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 71.3µs | 240.3µs | 🟢 3.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 774.9µs | 1.32ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 991.8µs | 1.83ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 961.4µs | 13.57ms | 🟢 14.1x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 22ns | 7ns | 🔴 3.3x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 158ns | 1.4µs | 🟢 8.7x faster |
| sub + unsub | 700ns | 2.2µs | 🟢 3.2x faster |
| atomFamily(id) | 572ns | 606ns | 🟢 1.1x faster |
| selectorFamily(id) | 442ns | 433ns | 🟡 1.0x slower |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 14ns |
| jotai get | 202ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 257ns |
| jotai set | 1.3µs |
