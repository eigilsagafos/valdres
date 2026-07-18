---
"valdres": patch
---

Make `atomFamily` and `selectorFamily` cache identity collision-free with a
type- and arity-tagged canonical key codec. Raw strings no longer overlap
serialized objects, Arrays, or Promise markers; a single Array argument remains
distinct from multiple arguments; BigInt keys are supported; and Map, Set, and
plain-object keys remain order-independent.

Family keys now reject Symbols, functions, Promises, class instances, accessor
properties, and cyclic structures with a descriptive `TypeError` instead of
silently merging them or overflowing the stack. Both family APIs accept an
optional typed `keyOf(...args)` option for deriving supported deterministic
identity from those arguments.

Structured member debug names now reuse the canonical key instead of running a
second display-only serialization on cache misses. Primitive names remain
concise.
