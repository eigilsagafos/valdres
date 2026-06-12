---
"valdres": minor
---

Add a machine-readable provenance tag to `store.txn`. The second argument now
accepts an options object — `store.txn(callback, { name?, origin? })` — alongside
the existing plain-string `name`. The `origin` is threaded through the commit and
surfaced as `meta.origin` on `store.onChange` callbacks for that transaction.

This gives middleware (state-sync layers, persistence, undo) a dedicated channel
to tag the transactions it applies so its own `onChange` listener can recognize
them (e.g. echo suppression) — without overloading `name`, which stays the
human-facing dev-tools label. Plain-string `name` behavior is unchanged, and
non-transaction paths (plain `set`/`reset`) leave `origin` undefined. The change
is additive and stays off the no-listener fast path (no new allocations when
nothing is watching).
