---
"valdres": minor
---

Remove the iterative selector-init trampoline. Selector evaluation now uses
plain recursion all the way down, matching jotai's strategy. This eliminates
the ~26x perf cliff at chain depths >100 (caused by `NeedsInitError`
exception-as-control-flow), and brings N=500 sub+unsub within parity of jotai.

**Behavior change:** selector chains beyond the JavaScript engine's call
stack capacity (~thousands of levels in practice) will now throw a
`RangeError` (possibly wrapped in `SelectorEvaluationError`) instead of
falling back to iterative evaluation. This matches jotai's failure mode and
applies only to chains far deeper than realistic application code. The
`processes deep atom a graph beyond maxDepth` jotai-compat test is now
skipped since valdres no longer exceeds jotai's guarantees there.
