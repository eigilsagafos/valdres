# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-09

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 51ns | 🟢 21.4x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 231ns | 2.1µs | 🟢 9.1x faster |
| set(atom, curr => curr+1) | 249ns | 2.7µs | 🟢 10.7x faster |
| set(atom) with 10 subs | 569ns | 3.5µs | 🟢 6.1x faster |
| atom lifecycle (create+100get+100set) | 26.4µs | 279.2µs | 🟢 10.6x faster |
| set 1000 atoms | 88.1µs | 1.22ms | 🟢 13.9x faster |
| get 1000 atoms | 4.0µs | 376.9µs | 🟢 94.1x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 72ns | 🟢 14.0x faster |
| set + read 10 selectors | 9.3µs | 28.3µs | 🟢 3.0x faster |
| set + read 100 selectors | 88.1µs | 337.7µs | 🟢 3.8x faster |
| set + read through 5 chained selectors | 8.4µs | 18.2µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 95.5µs | 421.2µs | 🟢 4.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 117.0µs | 757.3µs | 🟢 6.5x faster |
| txn: 10 atoms × 100 selectors, set + read | 789.4µs | 4.54ms | 🟢 5.7x faster |
| txn: cross-atom 1000 selectors, set + read | 917.6µs | 4.78ms | 🟢 5.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.16ms | 25.01ms | 🟢 21.6x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 280ns | 439ns | 🟢 1.6x faster |
| selectorFamily(id) | 317ns | 424ns | 🟢 1.3x faster |
| createStore | 620ns | 6.4µs | 🟢 10.3x faster |
| sub + unsub | 491ns | 2.5µs | 🟢 5.0x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 18ns |
| valdres get | 8ns |
| jotai get | 379ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 445ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 50ns | 🟢 2.1x faster |
| store.get(atom) | 12ns | 158ns | 🟢 13.5x faster |
| set(atom, value) | 408ns | 1.2µs | 🟢 3.0x faster |
| set(atom, curr => curr+1) | 438ns | 1.4µs | 🟢 3.3x faster |
| set(atom) with 10 subs | 787ns | 1.7µs | 🟢 2.1x faster |
| atom lifecycle (create+100get+100set) | 46.0µs | 140.3µs | 🟢 3.1x faster |
| set 1000 atoms | 118.9µs | 449.2µs | 🟢 3.8x faster |
| get 1000 atoms | 14.1µs | 214.3µs | 🟢 15.2x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 40ns | 55ns | 🟢 1.4x faster |
| set + read 10 selectors | 8.9µs | 19.1µs | 🟢 2.1x faster |
| set + read 100 selectors | 78.9µs | 127.8µs | 🟢 1.6x faster |
| set + read through 5 chained selectors | 4.9µs | 9.5µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 78.8µs | 138.7µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 79.7µs | 238.2µs | 🟢 3.0x faster |
| txn: 10 atoms × 100 selectors, set + read | 871.5µs | 1.33ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.08ms | 1.78ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.01ms | 12.10ms | 🟢 11.9x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 11ns | 6ns | 🟡 1.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 157ns | 1.2µs | 🟢 7.5x faster |
| sub + unsub | 763ns | 2.1µs | 🟢 2.7x faster |
| atomFamily(id) | 366ns | 487ns | 🟢 1.3x faster |
| selectorFamily(id) | 347ns | 352ns | 🟢 1.0x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 5ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 201ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 423ns |
| jotai set | 1.3µs |
