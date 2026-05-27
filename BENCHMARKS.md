# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-27

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 7ns | 65ns | 🟢 9.0x faster |
| store.get(atom) | 13ns | 355ns | 🟢 27.3x faster |
| set(atom, value) | 212ns | 4.3µs | 🟢 20.8x faster |
| set(atom, curr => curr+1) | 183ns | 5.0µs | 🟢 28.0x faster |
| set(atom) with 10 subs | 150ns | 3.4µs | 🟢 23.2x faster |
| atom lifecycle (create+100get+100set) | 12.0µs | 289.6µs | 🟢 24.8x faster |
| set 1000 atoms | 82.0µs | 935.9µs | 🟢 11.4x faster |
| get 1000 atoms | 8.3µs | 420.6µs | 🟢 50.8x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 10ns | 72ns | 🟢 7.4x faster |
| set + read 10 selectors | 7.3µs | 40.1µs | 🟢 5.4x faster |
| set + read 100 selectors | 62.6µs | 366.7µs | 🟢 5.5x faster |
| set + read through 5 chained selectors | 6.2µs | 14.3µs | 🟢 2.3x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 64.6µs | 385.6µs | 🟢 5.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 117.7µs | 638.4µs | 🟢 5.4x faster |
| txn: 10 atoms × 100 selectors, set + read | 951.9µs | 3.87ms | 🟢 4.1x faster |
| txn: cross-atom 1000 selectors, set + read | 884.5µs | 5.34ms | 🟢 6.0x faster |
| txn: cross-atom 1000 selectors, with subs | 1.76ms | 27.71ms | 🟢 16.0x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 32ns | 12ns | 🔴 2.6x slower |

#### Other

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 69.7µs | 105.4µs | 🟢 1.5x faster |
| sub+unsub on chain of 100 unsubscribed derived deps | 217.5µs | 231.5µs | 🟢 1.1x faster |
| sub+unsub on chain of 500 unsubscribed derived deps | 644.1µs | 600.6µs | 🟡 1.0x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 317ns | 441ns | 🟢 1.4x faster |
| selectorFamily(id) | 340ns | 456ns | 🟢 1.4x faster |
| createStore | 312ns | 6.1µs | 🟢 19.5x faster |
| sub + unsub | 1.4µs | 4.1µs | 🟢 3.1x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 11ns |
| jotai get | 363ns |
| obj.value = n | 5ns |
| map.set(key, n) | 17ns |
| valdres set | 128ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 28ns | 54ns | 🟢 1.8x faster |
| store.get(atom) | 23ns | 165ns | 🟢 7.3x faster |
| set(atom, value) | 215ns | 1.2µs | 🟢 5.6x faster |
| set(atom, curr => curr+1) | 228ns | 1.5µs | 🟢 6.5x faster |
| set(atom) with 10 subs | 257ns | 1.7µs | 🟢 6.8x faster |
| atom lifecycle (create+100get+100set) | 25.6µs | 138.5µs | 🟢 5.4x faster |
| set 1000 atoms | 81.3µs | 429.9µs | 🟢 5.3x faster |
| get 1000 atoms | 14.3µs | 205.9µs | 🟢 14.3x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 45ns | 59ns | 🟢 1.3x faster |
| set + read 10 selectors | 6.8µs | 14.6µs | 🟢 2.1x faster |
| set + read 100 selectors | 69.1µs | 134.2µs | 🟢 2.0x faster |
| set + read through 5 chained selectors | 4.2µs | 7.3µs | 🟢 1.8x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 140.7µs | 315.1µs | 🟢 2.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 97.9µs | 278.9µs | 🟢 2.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 863.9µs | 1.40ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 1.05ms | 1.88ms | 🟢 1.8x faster |
| txn: cross-atom 1000 selectors, with subs | 1.41ms | 12.74ms | 🟢 8.6x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 81ns | 29ns | 🔴 4.3x slower |

#### Other

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 100.1µs | 57.8µs | 🟡 1.7x slower |
| sub+unsub on chain of 100 unsubscribed derived deps | 196.2µs | 108.7µs | 🟡 1.8x slower |
| sub+unsub on chain of 500 unsubscribed derived deps | 942.3µs | 526.7µs | 🟡 1.8x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 201ns | 565ns | 🟢 2.8x faster |
| sub + unsub | 807ns | 1.5µs | 🟢 1.8x faster |
| atomFamily(id) | 203ns | 219ns | 🟢 1.1x faster |
| selectorFamily(id) | 140ns | 184ns | 🟢 1.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 24ns |
| valdres get | 18ns |
| jotai get | 202ns |
| obj.value = n | 1ns |
| map.set(key, n) | 7ns |
| valdres set | 200ns |
| jotai set | 1.3µs |
