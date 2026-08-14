---
"valdres": patch
---

Stop `selectorFamily` from retaining every member it has created. Both the
canonical key cache and string fast-path cache now hold selector identities
weakly, so an unreferenced member and its captured arguments, getter, cached
value, dependency graph, and encoded key can be reclaimed. Weakening and
bounded-group finalizer registration are batched outside the synchronous
creation path.

Member identity remains stable while a caller or live store retains it. Once a
member becomes unreachable, garbage collection may reclaim it and a later call
may create a fresh identity. `release(...args)` remains available for explicit
early cache eviction.
