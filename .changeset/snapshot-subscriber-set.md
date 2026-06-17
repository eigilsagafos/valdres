---
"valdres": patch
---

Snapshot the subscriber list at dispatch start on the immediate single-atom
notify path, matching the React/Redux contract.

Previously the non-batched single-atom fast path iterated the LIVE
`data.subscriptions` set, so subscription churn from inside a subscriber's
callback leaked into the in-flight dispatch: a listener subscribed during
dispatch fired for the same change, and a listener unsubscribed mid-dispatch was
order-dependently skipped. The list is now copied before firing (`[...subs]`),
so it's fixed at dispatch start — a listener added during dispatch does not fire
for the in-flight change (it fires on the next one), and a listener that was
present at dispatch start still fires even if another subscriber removes it
mid-dispatch.

This is a correctness fix for direct `store.sub` users and any adapter that
adds or removes subscriptions inside a callback. The React adapter is
unaffected: `useSyncExternalStore` does its sub/unsub in React's commit phase,
outside valdres's dispatch. The copy happens only on the path that handed
`callSubscribers` a live set and only when there are subscribers to fire; the
deferred (multi-pass commit) and selector paths already accumulate into a fresh
set and were already snapshotted.
