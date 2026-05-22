# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-22

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 5ns | 47ns | 🟢 9.7x faster |
| store.get(atom) | 10ns | 274ns | 🟢 27.5x faster |
| set(atom, value) | 169ns | 3.4µs | 🟢 20.7x faster |
| set(atom, curr => curr+1) | 152ns | 4.0µs | 🟢 26.3x faster |
| set(atom) with 10 subs | 120ns | 2.8µs | 🟢 22.8x faster |
| atom lifecycle (create+100get+100set) | 9.0µs | 216.8µs | 🟢 24.6x faster |
| set 1000 atoms | 65.2µs | 716.1µs | 🟢 11.1x faster |
| get 1000 atoms | 6.5µs | 324.0µs | 🟢 50.9x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 7ns | 53ns | 🟢 7.4x faster |
| set + read 10 selectors | 5.7µs | 24.8µs | 🟢 4.5x faster |
| set + read 100 selectors | 45.9µs | 284.9µs | 🟢 6.2x faster |
| set + read through 5 chained selectors | 4.3µs | 10.7µs | 🟢 2.5x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 48.2µs | 302.9µs | 🟢 6.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 83.6µs | 485.0µs | 🟢 5.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 690.6µs | 2.97ms | 🟢 4.4x faster |
| txn: cross-atom 1000 selectors, set + read | 628.4µs | 4.12ms | 🟢 5.1x faster |
| txn: cross-atom 1000 selectors, with subs | 1.21ms | 20.13ms | 🟢 16.9x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 23ns | 8ns | 🔴 2.8x slower |

#### Other

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 52.5µs | 60.6µs | 🟢 1.2x faster |
| sub+unsub on chain of 100 unsubscribed derived deps | 106.0µs | 117.4µs | 🟢 1.1x faster |
| sub+unsub on chain of 500 unsubscribed derived deps | 437.6µs | 460.9µs | 🟢 1.1x faster |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 250ns | 357ns | 🟢 1.4x faster |
| selectorFamily(id) | 249ns | 330ns | 🟢 1.4x faster |
| createStore | 247ns | 4.8µs | 🟢 19.3x faster |
| sub + unsub | 1.0µs | 3.1µs | 🟢 3.3x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 3ns |
| valdres get | 9ns |
| jotai get | 281ns |
| obj.value = n | 4ns |
| map.set(key, n) | 13ns |
| valdres set | 95ns |
| jotai set | 1.9µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 21ns | 40ns | 🟢 1.8x faster |
| store.get(atom) | 12ns | 156ns | 🟢 12.5x faster |
| set(atom, value) | 171ns | 1.0µs | 🟢 6.1x faster |
| set(atom, curr => curr+1) | 175ns | 1.3µs | 🟢 7.3x faster |
| set(atom) with 10 subs | 215ns | 1.4µs | 🟢 6.7x faster |
| atom lifecycle (create+100get+100set) | 18.5µs | 120.7µs | 🟢 6.6x faster |
| set 1000 atoms | 63.9µs | 340.3µs | 🟢 5.3x faster |
| get 1000 atoms | 11.1µs | 160.0µs | 🟢 14.4x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 35ns | 45ns | 🟢 1.2x faster |
| set + read 10 selectors | 5.2µs | 11.2µs | 🟢 2.2x faster |
| set + read 100 selectors | 53.7µs | 103.2µs | 🟢 1.9x faster |
| set + read through 5 chained selectors | 3.2µs | 6.2µs | 🟢 1.9x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 103.6µs | 244.3µs | 🟢 2.4x faster |
| txn: 10 atoms × 10 selectors, with subs | 71.8µs | 209.7µs | 🟢 2.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 659.1µs | 1.08ms | 🟢 1.7x faster |
| txn: cross-atom 1000 selectors, set + read | 791.9µs | 1.47ms | 🟢 1.9x faster |
| txn: cross-atom 1000 selectors, with subs | 1.02ms | 9.83ms | 🟢 9.6x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 71ns | 13ns | 🔴 5.2x slower |

#### Other

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 78.2µs | 46.4µs | 🟡 1.7x slower |
| sub+unsub on chain of 100 unsubscribed derived deps | 151.0µs | 88.6µs | 🟡 1.7x slower |
| sub+unsub on chain of 500 unsubscribed derived deps | 727.9µs | 431.0µs | 🟡 1.7x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 162ns | 435ns | 🟢 2.7x faster |
| sub + unsub | 633ns | 1.1µs | 🟢 1.8x faster |
| atomFamily(id) | 186ns | 173ns | 🟢 1.0x faster |
| selectorFamily(id) | 196ns | 182ns | 🟢 1.0x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 11ns |
| jotai get | 156ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 157ns |
| jotai set | 1.1µs |
