# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 4ns | 66ns | 🟢 14.9x faster |
| store.get(atom) | 30ns | 342ns | 🟢 11.4x faster |
| set(atom, value) | 165ns | 2.1µs | 🟢 12.7x faster |
| set(atom, curr => curr+1) | 196ns | 2.7µs | 🟢 13.6x faster |
| set(atom) with 10 subs | 188ns | 3.7µs | 🟢 19.6x faster |
| atom lifecycle (create+100get+100set) | 15.4µs | 277.7µs | 🟢 18.1x faster |
| set 1000 atoms | 70.6µs | 1.12ms | 🟢 15.8x faster |
| get 1000 atoms | 7.2µs | 485.2µs | 🟢 67.7x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 9ns | 80ns | 🟢 9.3x faster |
| set + read 10 selectors | 7.7µs | 28.5µs | 🟢 3.7x faster |
| set + read 100 selectors | 71.4µs | 313.3µs | 🟢 4.4x faster |
| set + read through 5 chained selectors | 6.8µs | 16.7µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 76.0µs | 287.7µs | 🟢 3.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 127.7µs | 567.6µs | 🟢 4.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 733.2µs | 3.23ms | 🟢 4.4x faster |
| txn: cross-atom 1000 selectors, set + read | 866.4µs | 4.39ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.40ms | 24.38ms | 🟢 17.4x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 44ns | 11ns | 🔴 4.0x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 301ns | 424ns | 🟢 1.4x faster |
| selectorFamily(id) | 333ns | 426ns | 🟢 1.3x faster |
| createStore | 553ns | 7.2µs | 🟢 13.0x faster |
| sub + unsub | 488ns | 2.5µs | 🟢 5.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 14ns |
| valdres get | 8ns |
| jotai get | 334ns |
| obj.value = n | 4ns |
| map.set(key, n) | 15ns |
| valdres set | 174ns |
| jotai set | 2.9µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 22ns | 54ns | 🟢 2.5x faster |
| store.get(atom) | 11ns | 154ns | 🟢 14.5x faster |
| set(atom, value) | 253ns | 1.4µs | 🟢 5.4x faster |
| set(atom, curr => curr+1) | 268ns | 1.5µs | 🟢 5.6x faster |
| set(atom) with 10 subs | 292ns | 1.9µs | 🟢 6.4x faster |
| atom lifecycle (create+100get+100set) | 29.7µs | 148.7µs | 🟢 5.0x faster |
| set 1000 atoms | 84.8µs | 435.6µs | 🟢 5.1x faster |
| get 1000 atoms | 12.9µs | 184.7µs | 🟢 14.3x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 39ns | 60ns | 🟢 1.6x faster |
| set + read 10 selectors | 8.4µs | 22.0µs | 🟢 2.6x faster |
| set + read 100 selectors | 71.2µs | 147.2µs | 🟢 2.1x faster |
| set + read through 5 chained selectors | 4.6µs | 11.4µs | 🟢 2.5x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 77.7µs | 155.1µs | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 73.4µs | 272.7µs | 🟢 3.7x faster |
| txn: 10 atoms × 100 selectors, set + read | 804.2µs | 1.55ms | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, set + read | 981.3µs | 2.10ms | 🟢 2.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.02ms | 13.59ms | 🟢 13.3x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 19ns | 5ns | 🔴 3.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 240ns | 1.6µs | 🟢 6.8x faster |
| sub + unsub | 848ns | 2.4µs | 🟢 2.8x faster |
| atomFamily(id) | 397ns | 482ns | 🟢 1.2x faster |
| selectorFamily(id) | 338ns | 432ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 11ns |
| jotai get | 185ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 249ns |
| jotai set | 1.4µs |
