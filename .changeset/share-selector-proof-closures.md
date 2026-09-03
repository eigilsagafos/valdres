---
"valdres": patch
---

Reduce selector reevaluation overhead by sharing completed negative cycle
proofs across repeated dependency checks at the same graph observation while
preserving cycle attribution and canonical path reporting.
