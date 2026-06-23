---
"valdres": patch
---

Clean up newly orphaned dependency selectors when the last subscriber to a leaf
selector unsubscribes. Hidden subtrees now drop their cached selector values and
reverse dependency edges instead of being re-evaluated on later upstream writes
despite having no live consumer.
