---
"valdres": patch
---

Reject non-JSON-safe atomFamily args in `dehydrate` (dev builds). Family args
cross the wire raw — schemas encode member values, not keys — and `hydrate`
re-derives each member with `family(...args)` from the parsed payload. A `Date`,
`Map`, `Set`, `BigInt`, `NaN`, `-0` or `undefined` argument does not survive
that round-trip, so the entry silently hydrated onto a phantom member (or made
`JSON.stringify` throw). Containers are checked by their own keys too — a
`toJSON` hook, an array expando, or a symbol-keyed property changes the parsed
result just as surely. Dev-mode `dehydrate` now throws a `TypeError` naming the
family and the argument path, e.g. `args[1].at[0] is a Date`. Production
behaviour is unchanged.
