---
"valdres": patch
---

Reuse bounded, frame-local graph worklists for selector scheduling and exact
cyclic-liveness reconciliation. A changed-seed closure scheduler evaluates
ordinary acyclic selectors once against finalized upstream values while no-op
multi-seed writes stop before downstream discovery. Dynamic dependency
replacement, re-entrant writes, and convergent cyclic fallback behavior remain
supported.
