---
"valdres": patch
---

Reuse one fully exhausted negative selector proof across exact graph changes
that preserve its closed dependency set. Dynamic selector graphs avoid repeating
the same cycle walk after unrelated or internal edge publications, while
incomplete or escaping changes still fall back to canonical proofs.
