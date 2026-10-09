---
"valdres": minor
---

Add experimental `Transaction.onCommit(callback): void` for deferred, scope-owned work after a draft commits. Successful no-ops deliver, aborts discard, and disposal cancels pending callbacks. Delivery starts in FIFO order with bounded yielding; asynchronous completion and application retry or cancellation policies remain caller-owned. Callback failures are reported separately from transaction errors.
