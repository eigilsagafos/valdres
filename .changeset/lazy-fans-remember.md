---
"valdres": patch
---

Fix a selector memoization loss that re-ran a selector's body on every read.

`initSelector` compared the freshly computed value against
`data.values.get(selector)` and skipped the write when the selector's `equal`
reported no change. On a FIRST evaluation there is no entry to compare against,
so `equal` was handed the absent-value sentinel `undefined` — and any selector
that computes `undefined` (or that uses a custom `equal` accepting `undefined`,
including `equal: () => true`) compared equal to nothing at all and was never
committed to the store.

Every cache hit downstream keys off `values.has(state)`, so an uncommitted
selector was permanently unmemoized: each `get()` re-ran its body. Repeated
reads of the same member inside ONE parent evaluation — what a recursive graph
traversal produces — became O(reads × full re-eval), and the cost multiplies per
level of a chain: 12 reads across three levels evaluated the leaf 157 times
instead of once. Writes were affected the same way, since re-evaluating a
dependent re-read the leaf once per `get()`. A consumer reading a trivial
`selectorFamily(ref => get => get(entity(ref)).data.duration)` leaf through a
traversal saw it evaluate ~467k times where 0.2.0-alpha.28 evaluated it a
handful of times — alpha.28 always wrote the value, so the memoization was
intact there.

The same "absent entry compares equal" flaw on the propagation path also dropped
a subscriber notification: a throwing evaluation drops the selector's value, so
a later recovery to `undefined` looked unchanged and its dependents were never
re-evaluated. Both paths now distinguish "absent" from "present and undefined"
before trusting `equal`; the extra probe is paid only when the value compared
against was `undefined`, so the steady-state hot path is unchanged (atom,
selector, and propagation benchmarks are flat).

The same root cause had a second symptom: a custom `equal` was invoked with the
absent-entry sentinel. `EqualFunc<Value>` types both operands as `Value`, so
`equal: (a, b) => a.id === b.id` on a `selector<{ id: number }>` is type-correct
with nothing to null-guard — yet it received `undefined` as `a` and threw on the
selector's very first read. On the propagation path the same call made a
selector unrecoverable: a throwing evaluation drops the value, so the recovery
compared against absence, the comparator threw again, the catch dropped the
recovered value, and the selector never escaped its error state. Presence is now
resolved _before_ `equal` is consulted rather than filtering its result
afterwards, so a comparator only ever sees two committed values — which is also
the honest reading of the contract, since with nothing committed the answer is
"not equal" by definition and there is no question to ask.

Three observable consequences beyond the speed. A custom `equal` that
dereferences its arguments now works on a selector's first read instead of
throwing. A subscriber now fires when a selector recovers from a throwing
evaluation into `undefined`, where before the change was silently dropped. And
`store.snapshot()` on an enumerable store now includes selectors whose value is
`undefined` — they were materialized all along, but absent from `values` and so
invisible to `snapshot()` and to anything built on it, such as
`@valdres/redux-devtools`.
