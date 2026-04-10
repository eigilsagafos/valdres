# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-10

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 4ns | 64ns | 🟢 17.3x faster |
| store.get(atom) | 27ns | 357ns | 🟢 13.2x faster |
| set(atom, value) | 161ns | 2.2µs | 🟢 13.7x faster |
| set(atom, curr => curr+1) | 193ns | 2.7µs | 🟢 13.9x faster |
| set(atom) with 10 subs | 195ns | 3.7µs | 🟢 18.8x faster |
| atom lifecycle (create+100get+100set) | 15.8µs | 283.9µs | 🟢 18.0x faster |
| set 1000 atoms | 71.0µs | 1.14ms | 🟢 16.0x faster |
| get 1000 atoms | 3.9µs | 497.5µs | 🟢 129.2x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 8ns | 82ns | 🟢 9.7x faster |
| set + read 10 selectors | 9.1µs | 28.2µs | 🟢 3.1x faster |
| set + read 100 selectors | 73.1µs | 302.7µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 7.2µs | 16.5µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 75.3µs | 283.2µs | 🟢 3.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 131.9µs | 570.2µs | 🟢 4.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 735.6µs | 3.07ms | 🟢 4.2x faster |
| txn: cross-atom 1000 selectors, set + read | 867.3µs | 4.48ms | 🟢 5.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.45ms | 23.90ms | 🟢 16.5x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 44ns | 12ns | 🔴 3.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 316ns | 425ns | 🟢 1.3x faster |
| selectorFamily(id) | 323ns | 415ns | 🟢 1.3x faster |
| createStore | 549ns | 7.2µs | 🟢 13.1x faster |
| sub + unsub | 487ns | 2.5µs | 🟢 5.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 14ns |
| valdres get | 7ns |
| jotai get | 340ns |
| obj.value = n | 4ns |
| map.set(key, n) | 15ns |
| valdres set | 184ns |
| jotai set | 3.0µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 22ns | 54ns | 🟢 2.5x faster |
| store.get(atom) | 11ns | 153ns | 🟢 14.4x faster |
| set(atom, value) | 247ns | 1.3µs | 🟢 5.3x faster |
| set(atom, curr => curr+1) | 264ns | 1.5µs | 🟢 5.8x faster |
| set(atom) with 10 subs | 287ns | 1.9µs | 🟢 6.6x faster |
| atom lifecycle (create+100get+100set) | 28.0µs | 146.9µs | 🟢 5.2x faster |
| set 1000 atoms | 84.4µs | 436.2µs | 🟢 5.2x faster |
| get 1000 atoms | 13.5µs | 184.4µs | 🟢 13.7x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 41ns | 60ns | 🟢 1.5x faster |
| set + read 10 selectors | 8.3µs | 20.3µs | 🟢 2.4x faster |
| set + read 100 selectors | 71.6µs | 133.0µs | 🟢 1.9x faster |
| set + read through 5 chained selectors | 4.7µs | 10.5µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 75.9µs | 157.5µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 74.4µs | 252.9µs | 🟢 3.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 796.2µs | 1.56ms | 🟢 2.0x faster |
| txn: cross-atom 1000 selectors, set + read | 992.6µs | 1.96ms | 🟢 2.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.02ms | 12.60ms | 🟢 12.4x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 11ns | 5ns | 🔴 2.1x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 243ns | 1.5µs | 🟢 6.4x faster |
| sub + unsub | 789ns | 2.2µs | 🟢 2.7x faster |
| atomFamily(id) | 359ns | 463ns | 🟢 1.3x faster |
| selectorFamily(id) | 329ns | 407ns | 🟢 1.2x faster |

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
| valdres set | 253ns |
| jotai set | 1.4µs |
