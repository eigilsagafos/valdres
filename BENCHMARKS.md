# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-23

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 5ns | 66ns | 🟢 13.1x faster |
| store.get(atom) | 30ns | 367ns | 🟢 12.2x faster |
| set(atom, value) | 165ns | 2.2µs | 🟢 13.5x faster |
| set(atom, curr => curr+1) | 197ns | 2.7µs | 🟢 13.6x faster |
| set(atom) with 10 subs | 192ns | 3.8µs | 🟢 19.8x faster |
| atom lifecycle (create+100get+100set) | 16.6µs | 276.6µs | 🟢 16.7x faster |
| set 1000 atoms | 72.4µs | 1.15ms | 🟢 15.9x faster |
| get 1000 atoms | 6.4µs | 488.8µs | 🟢 76.3x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 9ns | 84ns | 🟢 9.8x faster |
| set + read 10 selectors | 8.2µs | 29.2µs | 🟢 3.5x faster |
| set + read 100 selectors | 75.7µs | 313.2µs | 🟢 4.1x faster |
| set + read through 5 chained selectors | 6.9µs | 16.8µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 77.3µs | 298.2µs | 🟢 3.9x faster |
| txn: 10 atoms × 10 selectors, with subs | 129.2µs | 585.2µs | 🟢 4.5x faster |
| txn: 10 atoms × 100 selectors, set + read | 739.8µs | 3.29ms | 🟢 4.4x faster |
| txn: cross-atom 1000 selectors, set + read | 879.4µs | 4.66ms | 🟢 5.3x faster |
| txn: cross-atom 1000 selectors, with subs | 1.41ms | 24.87ms | 🟢 17.7x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 11ns | 🔴 2.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 306ns | 430ns | 🟢 1.4x faster |
| selectorFamily(id) | 329ns | 417ns | 🟢 1.3x faster |
| createStore | 571ns | 7.3µs | 🟢 12.8x faster |
| sub + unsub | 493ns | 2.5µs | 🟢 5.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 14ns |
| valdres get | 8ns |
| jotai get | 324ns |
| obj.value = n | 4ns |
| map.set(key, n) | 16ns |
| valdres set | 181ns |
| jotai set | 3.0µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 22ns | 55ns | 🟢 2.5x faster |
| store.get(atom) | 11ns | 162ns | 🟢 15.2x faster |
| set(atom, value) | 243ns | 1.3µs | 🟢 5.5x faster |
| set(atom, curr => curr+1) | 260ns | 1.5µs | 🟢 5.8x faster |
| set(atom) with 10 subs | 288ns | 1.9µs | 🟢 6.6x faster |
| atom lifecycle (create+100get+100set) | 28.9µs | 145.4µs | 🟢 5.0x faster |
| set 1000 atoms | 83.0µs | 434.5µs | 🟢 5.2x faster |
| get 1000 atoms | 13.3µs | 189.6µs | 🟢 14.2x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 61ns | 🟢 1.4x faster |
| set + read 10 selectors | 8.5µs | 21.5µs | 🟢 2.5x faster |
| set + read 100 selectors | 70.5µs | 138.8µs | 🟢 2.0x faster |
| set + read through 5 chained selectors | 4.6µs | 10.5µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 74.7µs | 159.7µs | 🟢 2.1x faster |
| txn: 10 atoms × 10 selectors, with subs | 75.7µs | 261.8µs | 🟢 3.5x faster |
| txn: 10 atoms × 100 selectors, set + read | 818.5µs | 1.44ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, set + read | 985.4µs | 1.85ms | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 1.10ms | 13.04ms | 🟢 11.9x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 19ns | 5ns | 🔴 3.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 263ns | 1.6µs | 🟢 6.1x faster |
| sub + unsub | 763ns | 2.3µs | 🟢 3.0x faster |
| atomFamily(id) | 396ns | 481ns | 🟢 1.2x faster |
| selectorFamily(id) | 317ns | 423ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 11ns |
| jotai get | 182ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 252ns |
| jotai set | 1.4µs |
