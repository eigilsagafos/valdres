# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-27

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 2ns | 55ns | 🟢 22.5x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 180ns | 2.1µs | 🟢 11.5x faster |
| set(atom, curr => curr+1) | 147ns | 2.7µs | 🟢 18.1x faster |
| set(atom) with 10 subs | 188ns | 3.5µs | 🟢 18.4x faster |
| atom lifecycle (create+100get+100set) | 16.9µs | 283.7µs | 🟢 16.8x faster |
| set 1000 atoms | 71.7µs | 1.19ms | 🟢 16.6x faster |
| get 1000 atoms | 7.3µs | 579.1µs | 🟢 79.3x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 6ns | 63ns | 🟢 10.1x faster |
| set + read 10 selectors | 9.2µs | 28.8µs | 🟢 3.1x faster |
| set + read 100 selectors | 81.7µs | 359.3µs | 🟢 4.4x faster |
| set + read through 5 chained selectors | 8.2µs | 19.1µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 83.2µs | 318.0µs | 🟢 3.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 145.9µs | 633.0µs | 🟢 4.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 793.7µs | 3.65ms | 🟢 4.6x faster |
| txn: cross-atom 1000 selectors, set + read | 954.7µs | 5.11ms | 🟢 5.4x faster |
| txn: cross-atom 1000 selectors, with subs | 1.48ms | 22.05ms | 🟢 14.9x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 30ns | 11ns | 🔴 2.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 359ns | 516ns | 🟢 1.4x faster |
| selectorFamily(id) | 383ns | 524ns | 🟢 1.4x faster |
| createStore | 748ns | 7.1µs | 🟢 9.5x faster |
| sub + unsub | 521ns | 2.5µs | 🟢 4.8x faster |

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
| jotai set | 3.5µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 27ns | 49ns | 🟢 1.8x faster |
| store.get(atom) | 14ns | 167ns | 🟢 12.0x faster |
| set(atom, value) | 257ns | 1.2µs | 🟢 4.8x faster |
| set(atom, curr => curr+1) | 255ns | 1.5µs | 🟢 5.9x faster |
| set(atom) with 10 subs | 292ns | 1.7µs | 🟢 5.8x faster |
| atom lifecycle (create+100get+100set) | 30.2µs | 143.7µs | 🟢 4.8x faster |
| set 1000 atoms | 81.0µs | 418.1µs | 🟢 5.2x faster |
| get 1000 atoms | 14.5µs | 204.9µs | 🟢 14.1x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 44ns | 54ns | 🟢 1.2x faster |
| set + read 10 selectors | 7.8µs | 19.7µs | 🟢 2.5x faster |
| set + read 100 selectors | 69.5µs | 131.1µs | 🟢 1.9x faster |
| set + read through 5 chained selectors | 4.6µs | 9.9µs | 🟢 2.2x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 69.8µs | 141.3µs | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 71.4µs | 237.9µs | 🟢 3.3x faster |
| txn: 10 atoms × 100 selectors, set + read | 800.1µs | 1.29ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 988.8µs | 1.84ms | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 962.2µs | 12.52ms | 🟢 13.0x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 23ns | 7ns | 🔴 3.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 155ns | 1.2µs | 🟢 7.6x faster |
| sub + unsub | 721ns | 2.1µs | 🟢 2.9x faster |
| atomFamily(id) | 449ns | 564ns | 🟢 1.3x faster |
| selectorFamily(id) | 309ns | 393ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 14ns |
| jotai get | 213ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 257ns |
| jotai set | 1.3µs |
