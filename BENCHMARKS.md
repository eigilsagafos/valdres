# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-24

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 5ns | 65ns | 🟢 13.8x faster |
| store.get(atom) | 26ns | 343ns | 🟢 13.2x faster |
| set(atom, value) | 166ns | 2.1µs | 🟢 12.9x faster |
| set(atom, curr => curr+1) | 189ns | 2.7µs | 🟢 14.2x faster |
| set(atom) with 10 subs | 193ns | 3.7µs | 🟢 19.2x faster |
| atom lifecycle (create+100get+100set) | 17.4µs | 278.2µs | 🟢 16.0x faster |
| set 1000 atoms | 72.0µs | 1.12ms | 🟢 15.6x faster |
| get 1000 atoms | 3.9µs | 488.5µs | 🟢 125.6x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 8ns | 83ns | 🟢 10.0x faster |
| set + read 10 selectors | 7.8µs | 28.5µs | 🟢 3.6x faster |
| set + read 100 selectors | 72.3µs | 312.9µs | 🟢 4.3x faster |
| set + read through 5 chained selectors | 6.9µs | 16.8µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 76.0µs | 289.5µs | 🟢 3.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 125.4µs | 566.4µs | 🟢 4.5x faster |
| txn: 10 atoms × 100 selectors, set + read | 709.7µs | 3.21ms | 🟢 4.5x faster |
| txn: cross-atom 1000 selectors, set + read | 866.2µs | 4.43ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.35ms | 23.71ms | 🟢 17.5x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 28ns | 11ns | 🔴 2.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 302ns | 424ns | 🟢 1.4x faster |
| selectorFamily(id) | 321ns | 405ns | 🟢 1.3x faster |
| createStore | 538ns | 7.2µs | 🟢 13.4x faster |
| sub + unsub | 466ns | 2.6µs | 🟢 5.5x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 15ns |
| valdres get | 7ns |
| jotai get | 327ns |
| obj.value = n | 4ns |
| map.set(key, n) | 15ns |
| valdres set | 182ns |
| jotai set | 2.9µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 22ns | 54ns | 🟢 2.5x faster |
| store.get(atom) | 11ns | 160ns | 🟢 14.2x faster |
| set(atom, value) | 245ns | 1.3µs | 🟢 5.3x faster |
| set(atom, curr => curr+1) | 261ns | 1.5µs | 🟢 5.7x faster |
| set(atom) with 10 subs | 288ns | 1.9µs | 🟢 6.5x faster |
| atom lifecycle (create+100get+100set) | 28.4µs | 137.5µs | 🟢 4.9x faster |
| set 1000 atoms | 80.3µs | 433.9µs | 🟢 5.4x faster |
| get 1000 atoms | 12.8µs | 188.2µs | 🟢 14.7x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 44ns | 61ns | 🟢 1.4x faster |
| set + read 10 selectors | 8.2µs | 21.0µs | 🟢 2.6x faster |
| set + read 100 selectors | 70.1µs | 132.9µs | 🟢 1.9x faster |
| set + read through 5 chained selectors | 4.5µs | 10.5µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 79.8µs | 146.4µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 73.0µs | 256.3µs | 🟢 3.5x faster |
| txn: 10 atoms × 100 selectors, set + read | 777.0µs | 1.43ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, set + read | 949.4µs | 1.99ms | 🟢 2.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.01ms | 12.36ms | 🟢 12.2x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 19ns | 6ns | 🔴 3.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 245ns | 1.5µs | 🟢 6.0x faster |
| sub + unsub | 850ns | 2.2µs | 🟢 2.6x faster |
| atomFamily(id) | 390ns | 474ns | 🟢 1.2x faster |
| selectorFamily(id) | 258ns | 406ns | 🟢 1.6x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 11ns |
| jotai get | 187ns |
| obj.value = n | 1ns |
| map.set(key, n) | 5ns |
| valdres set | 246ns |
| jotai set | 1.4µs |
