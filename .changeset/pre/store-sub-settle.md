---
"valdres": minor
---

**Experimental: `store.sub(state, { settle, notify })` adds a `settle` phase
that writes state before subscribers are notified.**

`sub` now also takes phase-keyed handlers. When a settlement changes `state`,
`settle` executes as its own synchronous transaction after selectors propagate
and before ordinary subscribers see the settlement. Its commit joins the same
settlement, so subscribers — including `notify` handlers and `valdres-react`
components — are notified once and only observe the input together with the
result it caused. `notify` behaves exactly like the callback form, and
`store.sub(state, callback)` is unchanged.

- Pass `settle`, `notify`, or both; one unsubscribe removes both. Any other key,
  or an object with neither handler, throws a `TypeError`.
- Subscribing never runs `settle`; only later changes of the trigger do.
- `notify` is not an on-success callback for `settle`: it observes every settled
  change of the trigger, including after its `settle` threw, and can run during
  subscribing without `settle`.
- `tx.get` reads the latest committed state, including earlier `settle` handlers
  in the same settlement, plus the handler's own staged writes.
- A `settle` handler that throws or returns a promise discards only its own
  writes; failures are reported after delivery as `SubscriberNotificationError`
  causes. If recomputing a selector fails inside a `settle` commit, that
  selector serves the failure as its error, and its dependents fail with it,
  until one of its inputs changes. Subscribers never see a value computed before
  the write.
- `settle` handlers run in at most 64 rounds per settlement; a settlement that
  needs more reports the new `SettleLimitError` (`VALDRES_SETTLE_LIMIT`).
- `valdres/inspect` records each `settle` commit as a commit span with
  `settle: true` and its own `result`.
- `settle` handlers read the latest state, so an earlier one can change whether
  a later one is still eligible; among eligible handlers, registration order
  decides.

Do I/O and DOM work that can re-enter an external source in `notify`, not in
`settle`. The `settle` phase is experimental during the beta.
