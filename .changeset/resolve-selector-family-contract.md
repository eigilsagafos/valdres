---
"valdres": patch
---

Make selector-family objects identity-cached factories rather than readable or
subscribable store state. Remove the untyped O(K) family-key enumeration path,
narrow family subscriptions to `atomFamily`, and reject invalid runtime
subscriptions consistently.

Align async construction with `selector()`: selector-family member getters must
be synchronous functions, but may return Promises. Cache hits remain unchanged;
the native-async guard runs only when a new member is created.
