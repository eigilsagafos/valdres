---
"valdres": patch
---

Global writes, resets, async settlement, max-age revalidation, and `resetSelf`
now execute through one CommitPlan forest. Each affected physical store is
visited once with the union of its local, inherited, shadow, and global trigger
groups, reducing repeated selector evaluation and custom-equality work while
preserving peer-before-origin observers, reports, cleanup, and first-error
ordering.
