---
"valdres": patch
---

Make orphan selector dependency cleanup iterative so unsubscribing deep selector
chains does not depend on JavaScript call-stack depth.
