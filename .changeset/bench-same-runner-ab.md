---
"valdres": patch
---

Internal: add same-runner A/B benchmark mode. PRs now run the full bench suite against their own branch and origin/main in the same CI VM, gating on the paired ratio between them rather than against a historical baseline. No public API change.
