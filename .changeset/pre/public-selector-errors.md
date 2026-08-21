---
"valdres": minor
---

Export `SelectorEvaluationError` and `SelectorCircularDependencyError` from the
package root so applications can distinguish selector failures with
`instanceof`. Give every Valdres error class a stable `.name`, make empty
selector-error traces safe to inspect, and standardize public native errors on
the `valdres:` message prefix with state names where available.
