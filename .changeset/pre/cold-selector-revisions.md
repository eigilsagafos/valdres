---
"valdres": patch
---

Keep selectors that are read without a live subscriber out of the strong reverse
dependency graph. Cold selector caches now validate forward dependency revisions
on demand and promote their dependency closure only when they become subscribed,
so dropped cold selectors can be collected and unrelated atom writes remain
constant-time regardless of prior cold reads.
