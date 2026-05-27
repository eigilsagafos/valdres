# Benchmark Details

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v2.19.0.

> Last updated: 2026-05-27

### Bun — JSC (Safari)

#### Atoms

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atom(1) | 6ns | 74ns | 🟢 9.9x faster |
| store.get(atom) | 13ns | 358ns | 🟢 27.9x faster |
| set(atom, value) | 250ns | 4.7µs | 🟢 19.3x faster |
| set(atom, curr => curr+1) | 109ns | 3.0µs | 🟢 27.2x faster |
| set(atom) with 10 subs | 193ns | 3.2µs | 🟢 16.9x faster |
| atom lifecycle (create+100get+100set) | 10.1µs | 277.9µs | 🟢 27.4x faster |
| set 1000 atoms | 77.9µs | 985.8µs | 🟢 12.9x faster |
| get 1000 atoms | 7.9µs | 377.9µs | 🟢 47.6x faster |

#### Selectors

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 8ns | 66ns | 🟢 7.9x faster |
| set + read 10 selectors | 7.0µs | 39.6µs | 🟢 5.3x faster |
| set + read 100 selectors | 64.1µs | 368.1µs | 🟢 5.6x faster |
| set + read 100 selectorFamily entries | 74.1µs | 376.7µs | 🟢 5.0x faster |
| set + read through 5 chained selectors | 6.5µs | 18.5µs | 🟢 2.4x faster |

#### Transactions

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 77.4µs | 232.7µs | 🟢 3.0x faster |
| txn: 10 atoms × 10 selectors, with subs | 135.8µs | 516.8µs | 🟢 3.9x faster |
| txn: 10 atoms × 100 selectors, set + read | 960.2µs | 2.80ms | 🟢 2.9x faster |
| txn: cross-atom 1000 selectors, set + read | 890.8µs | 3.06ms | 🟢 3.4x faster |
| txn: asymmetric DAG shared sink | 32.1µs | 109.1µs | 🟢 3.4x faster |
| txn: large asymmetric DAG (1000 leaves × 50 chain) | 5.63ms | 14.62ms | 🟢 2.5x faster |
| txn: cross-atom 1000 selectors, with subs | 1.61ms | 18.37ms | 🟢 11.3x faster |

#### Families

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 29ns | 11ns | 🔴 2.5x slower |

#### Other

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 106.1µs | 122.9µs | 🟢 1.1x faster |
| sub+unsub on chain of 100 unsubscribed derived deps | 208.6µs | 231.5µs | 🟢 1.1x faster |
| sub+unsub on chain of 500 unsubscribed derived deps | 602.2µs | 643.1µs | 🟢 1.1x faster |

#### Not yet optimized

| Benchmark | valdres | jotai | JSC (Safari) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) | 263ns | 394ns | 🟢 1.5x faster |
| selectorFamily(id) | 294ns | 296ns | 🟢 1.0x faster |
| createStore | 287ns | 5.9µs | 🟢 21.1x faster |
| sub + unsub | 1.3µs | 3.7µs | 🟢 3.0x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 4ns |
| valdres get | 11ns |
| jotai get | 361ns |
| obj.value = n | 4ns |
| map.set(key, n) | 17ns |
| valdres set | 121ns |
| jotai set | 2.9µs |

### Node.js — V8 (Chrome)

#### Atoms

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atom(1) | 25ns | 52ns | 🟢 1.9x faster |
| store.get(atom) | 24ns | 235ns | 🟢 7.2x faster |
| set(atom, value) | 246ns | 1.2µs | 🟢 5.1x faster |
| set(atom, curr => curr+1) | 267ns | 1.5µs | 🟢 5.6x faster |
| set(atom) with 10 subs | 297ns | 1.7µs | 🟢 5.7x faster |
| atom lifecycle (create+100get+100set) | 27.3µs | 140.9µs | 🟢 5.2x faster |
| set 1000 atoms | 82.4µs | 477.0µs | 🟢 5.8x faster |
| get 1000 atoms | 15.9µs | 212.0µs | 🟢 13.5x faster |

#### Selectors

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| selector(fn) | 47ns | 59ns | 🟢 1.2x faster |
| set + read 10 selectors | 7.1µs | 14.2µs | 🟢 2.0x faster |
| set + read 100 selectors | 72.3µs | 132.3µs | 🟢 1.8x faster |
| set + read 100 selectorFamily entries | 73.8µs | 130.5µs | 🟢 1.8x faster |
| set + read through 5 chained selectors | 4.8µs | 7.1µs | 🟢 1.5x faster |

#### Transactions

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| txn: 10 atoms × 10 selectors, set + read | 132.1µs | 289.1µs | 🟢 2.2x faster |
| txn: 10 atoms × 10 selectors, with subs | 101.6µs | 289.1µs | 🟢 2.8x faster |
| txn: 10 atoms × 100 selectors, set + read | 851.2µs | 1.36ms | 🟢 1.6x faster |
| txn: cross-atom 1000 selectors, set + read | 1.04ms | 1.84ms | 🟢 1.8x faster |
| txn: asymmetric DAG shared sink | 28.7µs | 58.3µs | 🟢 2.1x faster |
| txn: large asymmetric DAG (1000 leaves × 50 chain) | 4.17ms | 9.17ms | 🟢 2.2x faster |
| txn: cross-atom 1000 selectors, with subs | 1.18ms | 11.95ms | 🟢 8.9x faster |

#### Families

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| atomFamily(id) cache hit | 77ns | 16ns | 🔴 4.7x slower |

#### Other

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| sub+unsub on chain of 50 unsubscribed derived deps | 92.1µs | 57.5µs | 🟡 1.6x slower |
| sub+unsub on chain of 100 unsubscribed derived deps | 173.0µs | 109.5µs | 🟡 1.6x slower |
| sub+unsub on chain of 500 unsubscribed derived deps | 793.7µs | 527.2µs | 🟡 1.5x slower |

#### Not yet optimized

| Benchmark | valdres | jotai | V8 (Chrome) |
|:----------|--------:|------:|-----------:|
| createStore | 188ns | 497ns | 🟢 2.6x faster |
| sub + unsub | 884ns | 1.4µs | 🟢 1.6x faster |
| atomFamily(id) | 212ns | 231ns | 🟢 1.1x faster |
| selectorFamily(id) | 148ns | 172ns | 🟢 1.2x faster |

#### Baseline

Raw JS operations for reference.

| Operation | Time |
|:----------|-----:|
| obj.value | 0ns |
| map.get(key) | 24ns |
| valdres get | 17ns |
| jotai get | 201ns |
| obj.value = n | 1ns |
| map.set(key, n) | 6ns |
| valdres set | 215ns |
| jotai set | 1.4µs |
