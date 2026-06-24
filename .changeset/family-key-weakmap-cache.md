---
"valdres": patch
---

Speed up object-keyed `atomFamily`/`selectorFamily` cache hits by canonicalizing
the structural key per object identity in a `WeakMap`. Previously every call
re-ran `stableStringify`, which dominated cache-hit cost: ~280ns for a 2-key
object and ~1.6µs for a moderate nested filter. With identity-based
canonicalization the cache hit drops to ~18ns — on par with primitive-keyed
families.

No behavior change: the cached key string is identical to what `stableStringify`
would produce, so structural equality across different object literals with the
same shape still resolves to the same family member (and `release`/`del` still
work). The slow path runs once per object reference.
