# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-22

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 4ns | 58ns | 🟢 11.8x faster |
| store.get(atom) | 13ns | 342ns | 🟢 26.5x faster |
| set(atom, value) | 305ns | 4.2µs | 🟢 13.5x faster |
| set(atom, curr => curr+1) | 402ns | 5.7µs | 🟢 14.8x faster |
| set(atom) with 10 subs | 327ns | 6.0µs | 🟢 16.2x faster |
| atom lifecycle (create+100get+100set) | 16.5µs | 263.0µs | 🟢 15.9x faster |
| set 1000 atoms | 104.7µs | 918.2µs | 🟢 8.7x faster |
| get 1000 atoms | 8.7µs | 404.0µs | 🟢 52.3x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 7ns | 66ns | 🟢 10.1x faster |
| set + read 10 selectors | 7.3µs | 27.5µs | 🟢 3.7x faster |
| set + read 100 selectors | 62.1µs | 245.9µs | 🟢 4.0x faster |
| set + read through 5 chained selectors | 5.8µs | 13.2µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 75.0µs | 259.7µs | 🟢 3.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 130.8µs | 532.7µs | 🟢 4.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 869.5µs | 3.37ms | 🟢 3.9x faster |
| txn: cross-atom 1000 selectors, set + read | 841.9µs | 3.61ms | 🟢 4.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.37ms | 18.41ms | 🟢 13.3x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 11ns | 🔴 2.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 339ns | 504ns | 🟢 1.4x faster |
| selectorFamily(id) | 304ns | 402ns | 🟢 1.4x faster |
| createStore | 229ns | 6.0µs | 🟢 26.4x faster |
| sub + unsub | 1.1µs | 3.9µs | 🟢 4.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 12ns |
| jotai get | 347ns |
| obj.value = n | 1ns |
| map.set(key, n) | 19ns |
| valdres set | 187ns |
| jotai set | 3.1µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 26ns | 54ns | 🟢 1.9x faster |
| store.get(atom) | 13ns | 161ns | 🟢 12.0x faster |
| set(atom, value) | 302ns | 1.2µs | 🟢 4.1x faster |
| set(atom, curr => curr+1) | 309ns | 1.5µs | 🟢 4.7x faster |
| set(atom) with 10 subs | 502ns | 1.7µs | 🟢 3.4x faster |
| atom lifecycle (create+100get+100set) | 32.4µs | 141.5µs | 🟢 4.4x faster |
| set 1000 atoms | 92.7µs | 462.6µs | 🟢 5.0x faster |
| get 1000 atoms | 16.2µs | 210.1µs | 🟢 13.2x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 43ns | 55ns | 🟢 1.3x faster |
| set + read 10 selectors | 8.1µs | 14.8µs | 🟢 1.8x faster |
| set + read 100 selectors | 81.5µs | 135.0µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 4.3µs | 7.4µs | 🟢 1.7x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 144.0µs | 291.3µs | 🟢 2.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 97.4µs | 285.8µs | 🟢 2.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 902.6µs | 1.40ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.11ms | 1.81ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.23ms | 12.59ms | 🟢 9.7x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 27ns | 10ns | 🔴 2.9x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 163ns | 552ns | 🟢 3.4x faster |
| sub + unsub | 793ns | 1.4µs | 🟢 1.8x faster |
| atomFamily(id) | 144ns | 204ns | 🟢 1.5x faster |
| selectorFamily(id) | 170ns | 203ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 9ns |
| valdres get | 17ns |
| jotai get | 200ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 292ns |
| jotai set | 1.4µs |
