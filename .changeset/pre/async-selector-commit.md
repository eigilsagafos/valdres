---
"valdres": patch
---

Treat successful async selector settlement as a commit. `onCommitEnd` now
fires once after selector subscribers and `onChange`, while observer failures
remain distinct from source-Promise rejection and are no longer swallowed.
