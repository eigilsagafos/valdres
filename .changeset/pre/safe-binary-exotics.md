---
"valdres": patch
---

Compare ArrayBuffer, SharedArrayBuffer, DataView, and typed-array values by
their visible bytes, fixing unequal buffers being treated as equal and DataView
comparisons hanging.

Development deep-freezing now rejects mutable built-ins and host objects with an
actionable `{ mutable: true }` requirement instead of throwing native
typed-array errors or leaving Map, Set, Date, and binary contents mutable behind
a frozen facade. The explicit opt-out is available on atoms and selectors; Error
objects and Promise handles remain supported.
