---
"valdres": patch
"valdres-react": patch
---

Move React snapshot reads that precede subscriptions off recursive cold-cache
validation. An observed selector now restores its reverse dependency graph,
catches changed selectors up once in dependency order, and serves later reads
from the live O(1) cache path. Revisions shared by many selectors are resolved
once per promotion instead of once per dependency edge.

If the render commits, its subscription claims the restored graph. A synchronous
abandoned render is demoted in a microtask; a suspended render stays resumable
until its current Promise settles, then an unclaimed graph is demoted. Dynamic
cycles and re-entrant writes preserve the existing cold-read behavior.
