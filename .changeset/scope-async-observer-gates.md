---
"valdres": patch
---

Async atom settlements no longer take the heavier observer propagation and
reporting path when the only `onChange` or `onCommitEnd` listeners are attached
to unrelated store trees. An otherwise unobserved async atom now settles on the
lightweight path, while listeners on the affected store tree still select the
observer path as before.
