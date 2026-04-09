# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-04-09

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 3ns | 51ns | 🟢 20.2x faster |
| store.get(atom) | 40ns | 381ns | 🟢 9.5x faster |
| set(atom, value) | 170ns | 2.2µs | 🟢 12.7x faster |
| set(atom, curr => curr+1) | 200ns | 2.8µs | 🟢 13.8x faster |
| set(atom) with 10 subs | 194ns | 3.9µs | 🟢 19.9x faster |
| atom lifecycle (create+100get+100set) | 15.6µs | 283.8µs | 🟢 18.2x faster |
| set 1000 atoms | 71.3µs | 1.17ms | 🟢 16.5x faster |
| get 1000 atoms | 6.5µs | 375.1µs | 🟢 57.8x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 5ns | 59ns | 🟢 11.0x faster |
| set + read 10 selectors | 8.3µs | 27.8µs | 🟢 3.4x faster |
| set + read 100 selectors | 77.1µs | 325.2µs | 🟢 4.2x faster |
| set + read through 5 chained selectors | 7.2µs | 17.5µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 78.8µs | 428.6µs | 🟢 5.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 134.8µs | 749.3µs | 🟢 5.6x faster |
| txn: 10 atoms × 100 selectors, set + read | 764.2µs | 4.49ms | 🟢 5.9x faster |
| txn: cross-atom 1000 selectors, set + read | 901.0µs | 4.74ms | 🟢 5.3x faster |
| txn: cross-atom 1000 selectors, with subs | 1.40ms | 25.31ms | 🟢 18.1x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 48ns | 11ns | 🔴 4.4x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 344ns | 485ns | 🟢 1.4x faster |
| selectorFamily(id) | 346ns | 473ns | 🟢 1.4x faster |
| createStore | 582ns | 6.3µs | 🟢 10.9x faster |
| sub + unsub | 461ns | 2.5µs | 🟢 5.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 4ns |
| map.get(key) | 18ns |
| valdres get | 8ns |
| jotai get | 369ns |
| obj.value = n | 4ns |
| map.set(key, n) | 18ns |
| valdres set | 189ns |
| jotai set | 3.3µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 24ns | 50ns | 🟢 2.1x faster |
| store.get(atom) | 12ns | 158ns | 🟢 13.6x faster |
| set(atom, value) | 295ns | 1.2µs | 🟢 4.1x faster |
| set(atom, curr => curr+1) | 306ns | 1.5µs | 🟢 4.8x faster |
| set(atom) with 10 subs | 322ns | 1.7µs | 🟢 5.3x faster |
| atom lifecycle (create+100get+100set) | 31.9µs | 139.0µs | 🟢 4.4x faster |
| set 1000 atoms | 87.9µs | 454.3µs | 🟢 5.2x faster |
| get 1000 atoms | 14.3µs | 205.9µs | 🟢 14.4x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 45ns | 56ns | 🟢 1.2x faster |
| set + read 10 selectors | 8.6µs | 19.1µs | 🟢 2.2x faster |
| set + read 100 selectors | 76.1µs | 126.8µs | 🟢 1.7x faster |
| set + read through 5 chained selectors | 4.9µs | 9.9µs | 🟢 2.0x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 77.4µs | 139.1µs | 🟢 1.8x faster |
| txn: 10 atoms × 10 selectors, with subs | 77.6µs | 242.1µs | 🟢 3.1x faster |
| txn: 10 atoms × 100 selectors, set + read | 850.7µs | 1.28ms | 🟢 1.5x faster |
| txn: cross-atom 1000 selectors, set + read | 1.08ms | 1.78ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, with subs | 1.04ms | 12.38ms | 🟢 11.9x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 11ns | 7ns | 🟡 1.6x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 161ns | 1.2µs | 🟢 7.6x faster |
| sub + unsub | 772ns | 2.1µs | 🟢 2.8x faster |
| atomFamily(id) | 404ns | 514ns | 🟢 1.3x faster |
| selectorFamily(id) | 321ns | 379ns | 🟢 1.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 5ns |
| valdres get | 12ns |
| jotai get | 198ns |
| obj.value = n | 1ns |
| map.set(key, n) | 8ns |
| valdres set | 283ns |
| jotai set | 1.3µs |
