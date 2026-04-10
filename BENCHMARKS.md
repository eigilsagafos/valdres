# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-10

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 54ns | 🟢 22.0x faster |
| store.get(atom) | 40ns | 380ns | 🟢 9.5x faster |
| set(atom, value) | 171ns | 2.2µs | 🟢 12.7x faster |
| set(atom, curr => curr+1) | 200ns | 2.7µs | 🟢 13.5x faster |
| set(atom) with 10 subs | 192ns | 3.6µs | 🟢 19.0x faster |
| atom lifecycle (create+100get+100set) | 15.3µs | 280.3µs | 🟢 18.4x faster |
| set 1000 atoms | 69.5µs | 1.18ms | 🟢 16.9x faster |
| get 1000 atoms | 4.1µs | 369.1µs | 🟢 89.2x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 7ns | 62ns | 🟢 9.4x faster |
| set + read 10 selectors | 8.3µs | 30.5µs | 🟢 3.7x faster |
| set + read 100 selectors | 75.8µs | 333.5µs | 🟢 4.4x faster |
| set + read through 5 chained selectors | 8.2µs | 18.0µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 79.6µs | 392.8µs | 🟢 4.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 106.1µs | 655.3µs | 🟢 6.2x faster |
| txn: 10 atoms × 100 selectors, set + read | 705.3µs | 4.52ms | 🟢 6.4x faster |
| txn: cross-atom 1000 selectors, set + read | 861.5µs | 4.81ms | 🟢 5.6x faster |
| txn: cross-atom 1000 selectors, with subs | 1.10ms | 25.69ms | 🟢 23.4x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 54ns | 11ns | 🔴 4.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 373ns | 523ns | 🟢 1.4x faster |
| selectorFamily(id) | 382ns | 517ns | 🟢 1.4x faster |
| createStore | 661ns | 6.7µs | 🟢 10.2x faster |
| sub + unsub | 500ns | 2.4µs | 🟢 4.8x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 16ns |
| valdres get | 8ns |
| jotai get | 357ns |
| obj.value = n | 5ns |
| map.set(key, n) | 18ns |
| valdres set | 184ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 27ns | 48ns | 🟢 1.8x faster |
| store.get(atom) | 13ns | 160ns | 🟢 12.6x faster |
| set(atom, value) | 275ns | 1.2µs | 🟢 4.4x faster |
| set(atom, curr => curr+1) | 287ns | 1.5µs | 🟢 5.1x faster |
| set(atom) with 10 subs | 319ns | 1.8µs | 🟢 5.5x faster |
| atom lifecycle (create+100get+100set) | 32.0µs | 136.6µs | 🟢 4.3x faster |
| set 1000 atoms | 94.9µs | 421.1µs | 🟢 4.4x faster |
| get 1000 atoms | 13.8µs | 205.7µs | 🟢 14.9x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 53ns | 🟢 1.2x faster |
| set + read 10 selectors | 7.1µs | 19.8µs | 🟢 2.8x faster |
| set + read 100 selectors | 70.4µs | 127.6µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.1µs | 9.9µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 69.8µs | 135.6µs | 🟢 1.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 71.9µs | 236.8µs | 🟢 3.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 782.7µs | 1.32ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 981.1µs | 1.78ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 934.1µs | 12.62ms | 🟢 13.5x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 10ns | 7ns | 🟡 1.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 156ns | 1.2µs | 🟢 8.0x faster |
| sub + unsub | 678ns | 2.1µs | 🟢 3.1x faster |
| atomFamily(id) | 441ns | 570ns | 🟢 1.3x faster |
| selectorFamily(id) | 370ns | 434ns | 🟢 1.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 6ns |
| valdres get | 13ns |
| jotai get | 202ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 264ns |
| jotai set | 1.3µs |
