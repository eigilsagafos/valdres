---
"valdres": patch
---

Index active inherited dependencies by immediate scope branch so parent atom
updates traverse only subtrees with affected selectors. The index follows
dynamic dependency churn, nested atom shadows, `unset`, unsubscribe cleanup, and
scope detach; atom-family membership inheritance remains branch-aware.

Root atom-set latency with 10,000 idle scopes is now effectively flat against
the no-scope path (~90ns in the Bun benchmark), instead of scaling into hundreds
of microseconds by visiting every scope.
