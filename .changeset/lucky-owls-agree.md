---
"valdres": patch
---

Fix a deferred `get` reading through a disposed store.

A selector body that calls `get` after its synchronous evaluation finished
(after an `await`, or from a `setTimeout`) is the one way to reach a store once
it has been disposed. That call is supposed to throw `StoreDisposedError`. It
did — unless the store had never cached a cold selector, in which case the read
silently succeeded against the dead store and the consumer never learned the
store was gone.

The two cases ran different evaluators (`evaluateSelector` vs its live-only
twin), and only the first carried the disposal guard. Whether an app hit the bug
depended on whether it had ever read a selector it hadn't subscribed to, which
is not a distinction the disposal contract should turn on.

Both evaluator twins are now held to one another by
`selectorEvaluatorTwinFuzz.test.ts`, which drives the same program through each
and compares every read, notification, dependency edge, liveness count and mount
transition.
