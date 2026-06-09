---
"valdres": patch
---

Move the pending-default suspense placeholder for atoms declared with no
`defaultValue` from monkey-patched `__isEmptyAtomPromise__` /
`__resolveEmptyAtomPromise__` / `__emptyAtomPromiseOrigin__` properties on
Promise instances to a `WeakMap` on the store data. The Promise returned by
`get()` is now a plain Promise with no internal markers leaked to user code.

Fixes two latent bugs along the way: a sync `set()` after an in-flight async
`set()` on an empty atom now resolves the suspense placeholder (previously it
hung); and `set()` from a scoped store on an empty atom inited in a parent
now resolves the placeholder via the scope chain (previously hung).
