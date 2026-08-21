---
"valdres": patch
"valdres-react": patch
---

Make `store.get(selector)` return a stable reference across repeated reads of a
derived selector that has no live consumer (not subscribed, no live dependents).
Previously the first read of such a selector returned a different reference than
subsequent reads, even when nothing had changed — values were always correct,
only reference identity was unstable while unsubscribed. This is what tripped
React's "The result of getSnapshot should be cached to avoid an infinite loop"
warning at initial mount, before `useSyncExternalStore` establishes its
subscription.

Root cause: a read that materializes new atoms runs an init-only propagation to
register them. That pass walks the just-read selector's dependents and, for any
selector with no live consumer, drops its freshly-computed cache "for lazy
re-eval" — so the very next read re-evaluated and produced a new reference. The
read path (`getDefault`) now restores the read selector's freshly-computed value
after that pass, so repeated unsubscribed reads are reference-stable.

The restore applies only to the selector being read. A selector reached merely
transitively — e.g. one that read a family whose membership the read just changed
— is still invalidated, so genuine staleness is picked up on its next read. A
side benefit: a selector read without a subscription is now computed exactly once
instead of twice (the init-time double-evaluation is gone).
