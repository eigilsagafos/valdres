---
"valdres": patch
---

Fix fresh atom subscriptions whose selector defaults initialize other atoms by
finishing nested initialization through the normal init-only propagation path.
Also register atom-family members initialized by their first subscription in
the family index, matching initialization through `store.get`.
