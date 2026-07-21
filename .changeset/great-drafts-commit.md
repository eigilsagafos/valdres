---
"valdres": patch
---

Transaction staging now lives in a dedicated MutationDraft write overlay, and every single-store transaction commit executes through the shared CommitPlan engine. Two deliberate edge-case fixes ride along: (1) when reporting an unset during a transaction commit itself fails (for example a throwing function default evaluated by the report's parent read-through), the first captured commit error — such as an earlier onSet hook error — now surfaces instead of being masked by the reporting failure; (2) transaction staging now validates schemas before dev-freezing, so validators observe the same (unfrozen) value representation as direct writes.
