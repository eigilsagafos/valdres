---
"valdres": patch
---

Fix fresh atom subscriptions whose selector defaults initialize other atoms by
finishing nested initialization through the normal init-only propagation path.
