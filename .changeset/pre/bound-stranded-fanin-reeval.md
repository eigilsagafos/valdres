---
"valdres": patch
---

Bound redundant selector re-evaluation for wide fan-in selectors under dynamic
dependency churn.

The downstream topological propagation walk now treats removal from its
`pending` map as the settled marker, preventing dynamically changed dependency
edges from repeatedly re-queueing an already finalized selector. When a graph
mutation still requires a settled selector to be revisited, that selector and its
downstream closure are deferred to the stranded settle phase, which now settles
work in dependency order before falling back for cyclic regions. This preserves
correctness for escaped/stranded dynamic-dependency cases while avoiding repeated
evaluation of subscribed wide aggregators during transient settle waves.
