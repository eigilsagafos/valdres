---
"valdres": patch
---

Finish propagating atom updates and family-member deletions through descendant
scopes before invoking any store-tree subscribers. A throwing root subscriber
can no longer interrupt propagation and leave a child selector stale; every
affected store settles first, all collected subscribers are attempted, and the
first callback error is rethrown after notification completes.

Keep descendant selector-aware `onChange` listeners ordered after subscribers,
and allocate deferred notification entries only for stores that actually have
callbacks to dispatch.
