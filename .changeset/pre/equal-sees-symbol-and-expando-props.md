---
"valdres": patch
---

Stop dropping writes that the default equality check could not see. Values
differing only in a symbol-keyed own enumerable property, in a property set
beside the contents of an array, `Map` or `Set`, or in a property that a custom
`valueOf` / `toString` does not expose all compared equal, so `set()` bailed as
a no-op: the store kept the old value, no subscriber fired, and nothing warned.

Own enumerable properties — symbol-keyed ones included — are now part of the
comparison for plain objects, arrays (holes and expandos included), `Map`, `Set`
and `RegExp`, and a custom `valueOf` / `toString` narrows the comparison instead
of replacing it. Binary buffers and views still compare by their bytes alone,
because enumerating a typed array's keys costs time proportional to its length.

The identity and early-exit paths are unchanged; the added work is spent only
once two distinct values have otherwise compared equal.
