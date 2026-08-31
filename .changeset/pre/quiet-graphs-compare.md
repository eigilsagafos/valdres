---
"valdres": minor
---

Add `deepEqual` as an opt-in two-argument comparator from `valdres/equality`.
Atoms and selectors still default to `Object.is`, and the helper stays outside
ordinary root bundles. Use it to retain the previous reference and prune
notifications or downstream propagation when a replacement is structurally
equal; comparison cost grows with the values traversed, and cyclic structures
remain unsupported.
