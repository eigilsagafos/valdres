---
"valdres": patch
---

`family()` now reports actionable TypeScript diagnostics for invalid factories.
A structured-argument factory without `options.encodeKey` used to fail with
"not assignable to parameter of type 'never'"; the compiler output now names
the fix ("structured family arguments require options.encodeKey"), and
zero-argument, non-State-returning, and unannotated factories get their own
messages. Valid calls infer exactly as before.
