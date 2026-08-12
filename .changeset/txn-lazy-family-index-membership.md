---
"valdres": patch
---

Fix family-index membership for atoms lazily initialized inside a transaction.
Reading an uninitialized family member with `txn.get(family(key))` wrote its
default into committed store data but never registered the member in the family
index, so the member held a value while being permanently absent from
`get(family)`.

A lazy init inside a transaction now produces exactly the observable result of
the direct read it stands in for — membership, dependent-selector values,
subscriber and `onCommitEnd` notifications, notification ORDER, and `onChange`
(which stays silent for a lazy read, while real writes in the same transaction
still report) — whilst coalescing into the transaction's single commit, so each
observer fires at most once.

This holds inside a scope too, where a `del` or `unset` of an inherited member
touches no local value: the family index's tombstone, not a local cleanup set or
the presence of a value further up the chain, decides whether a member survives.

Membership is staged into the working index while the transaction is open, and
the members no value-changing write carried are settled by the commit itself as
a trigger group on its plan — one that counts as commit work even when it is the
only group, so a lazy read of an already-registered member still notifies. Being
part of the commit is what makes subscribers precede `onChange` and brings the
engine's error continuation to bear: a throwing subscriber, hook, or `equal` can
no longer leave a member holding a value with no membership, and the repair such
a failure triggers neither resurrects a member the transaction deleted nor
reports commit-end twice. Aborting settles the tree the same way — collected and
marked terminal first, then settled behind one boundary with one notification
phase, so no callback observes a half-settled tree or reaches a still-open
context.
