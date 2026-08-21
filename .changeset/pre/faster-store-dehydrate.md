---
"valdres": patch
---

Make `dehydrate(store)` proportional to that store's named state. Named atoms
are indexed lazily per store, and named family entries now iterate the store's
own family membership instead of the process-global registry and identity
cache.
