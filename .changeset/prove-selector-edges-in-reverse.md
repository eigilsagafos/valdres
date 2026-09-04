---
"valdres": patch
---

Reduce selector cycle-proof work by checking bounded committed reverse adjacency
before walking a proposed dependency's forward closure. Positive,
nested-transient, unsupported, and budget-limited cases retain the canonical
forward proof and exact cycle path. Inspection schema v4 reports reverse
outcomes and work separately from forward visits.
