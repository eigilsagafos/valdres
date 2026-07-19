---
"valdres": patch
---

Preserve atom-family member identity when a member is deleted from one store or
scope but remains in another. `store.del(member)` now removes only that store's
membership instead of globally releasing the family's shared identity, matching
transactional deletion and preventing two member objects for the same logical
key.

Atom-family identity caches now hold members weakly, so keeping identities
stable across stores does not make the family retain every unused member
forever. The legacy `atomFamily.release()` method is now a deprecated no-op:
explicit eviction is unnecessary with the weak cache and could create a second
live member for arguments whose original member is still retained by a store.
