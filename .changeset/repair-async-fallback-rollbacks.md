---
"valdres": patch
---

Prevent rejected async atom writes from restoring a settled Promise without a
live settlement coordinator. Promise fallbacks from earlier writes, async
function or selector defaults, and parent scopes now converge to a settled atom
value, including for dependent selectors, without retaining completed
coordinator chains.
