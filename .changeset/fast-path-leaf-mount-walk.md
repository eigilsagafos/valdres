---
"valdres": patch
---

Skip the transitive mount/unmount walk when the start state is a leaf with no
`onMount`. The walk allocates a `Set` and `Array` and was firing on every
selector dep change during propagation, even when the dep was a plain atom
with no mountable subtree — which is the common case. On the integration
benchmark (one state update fanning out to ~200 subscribed selectors with
churning deps) this restores parity with `0.2.0-pre.28`; the dedicated
dep-churn microbench improves from `1.87×` slower to `1.18×` slower.
