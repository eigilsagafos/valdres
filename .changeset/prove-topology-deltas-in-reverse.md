---
"valdres": patch
---

Speed up dynamic selector rewiring by proving topology-delta safety from bounded
reverse ancestry, including active transient prefixes while preserving canonical
cycle reporting. Inspection exports now use core schema v5 because reverse-proof
totals cover both new-edge and topology-delta proofs, including the construction
cost and fail-closed outcomes of transient-prefix snapshots.
