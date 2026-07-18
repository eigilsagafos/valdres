---
"valdres": patch
---

Make atom-family membership maintenance linear for repeated transaction and
hydration writes by skipping value-only index churn, rendering dirty indices
once, and batching hydrated members per family.
