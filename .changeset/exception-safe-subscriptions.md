---
"valdres": patch
---

Roll back subscription and liveness state when `onMount` throws so a later
subscription retries the mount. Keep orphaned selector graph and cache cleanup
queued when lifecycle cleanup throws during unsubscribe.
