---
"valdres": patch
---

A throw during commit-forest settlement collection no longer leaves the commit
depth above zero, which previously silenced all future `onCommitEnd` delivery.
Multi-root commit boundaries now close even when an earlier root or listener
throws, and the first error thrown is still the one propagated.
