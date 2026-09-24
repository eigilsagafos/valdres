# Store reactions (`store.react`)

Status: owner-approved and experimental during the beta. The API, failure
policy, error model, and inspect additions below are approved decisions, as are
the contract re-pins and the size budgets.

## Problem

A command triggered by input — for example a keyboard shortcut read through an
`externalAtom` — needs to write application state. Ordinary subscribers may not
write the Store. A write deferred until after notification publishes twice:
observers first see the new input paired with the old result, and then the
result. Reactions put the command's writes inside the same settlement, before
ordinary notification.

## Decisions

- **API.** `store.react(state, run: TransactionCallback): () => void` is a bound
  Store method. It uses `Store.sub` admission, validation, retention, and
  idempotent removal. Registering never runs it, including during admission
  catch-up.
- **Settlement.** When a settlement changes the trigger's served token, `run`
  executes as its own TreeTransaction. This happens after selector propagation
  and before the one frozen ordinary snapshot is captured. Each reaction's
  commit joins the boundary. Ordinary delivery happens once, over the union of
  targets reached, with existing deduplication and invalidation semantics. The
  guarantee is per settlement and per StoreTree.
- **Reads and order.** `tx.get` reads the latest committed state plus the
  reaction's own draft. Waves run in first-reaching-target order, then
  registration order. A reaction reached again while still pending in the
  current wave runs once, on the newer state. One that already ran joins the
  next wave. Eligibility is not frozen at event time, and among eligible
  reactions registration order decides.
- **Limit.** At most 64 nonempty waves run per boundary. If another wave is
  needed, `ReactionLimitError` / `VALDRES_REACTION_LIMIT` is reported and no
  pending work survives the boundary.
- **Failures.** A throw, a thenable result, or a staging failure aborts only
  that reaction's draft. Earlier commits and the initiating update remain. A
  failure after apply keeps the writes and propagates them before delivery.
  Thrown values are inspected under transaction-result guards. Failures are
  reported after the one delivery as `SubscriberNotificationError` causes, ahead
  of subscriber throws. Its frozen `phase: "notifying"` names the reporting
  boundary, not the moment each cause occurred.
- **Capabilities.** A reaction has transaction-callback capabilities only.
  Captured Store work, unsubscribe, and same-domain source invalidation stay
  rejected.
- **Inspect.** Each reaction's commit is a `CommitInspection` row carrying
  `reaction: true`, its `scope`, and its own `result`. A row triggered outside a
  Store operation has `operationId: 0`. `schemaVersion` stays 7: the fields are
  optional and additive.

## Size certification

A Store method is retained by every Store bundle, so the reaction machinery is
not tree-shaken. Measured on pinned Bun 1.4.0 against clean `main` (`a18963f9`):

| Fixture                                | main raw / gzip | reactions raw / gzip | Change        |
| -------------------------------------- | --------------- | -------------------- | ------------- |
| `atom-selector-store` (core-retaining) | 64,767 / 17,314 | 66,270 / 17,820      | +1,503 / +506 |

`atom-selector-store` is now 551 gzip bytes over its immutable 2% ceiling
(17,269). The reviewed core-retaining allowance therefore rises from 77 to 551,
the new exact no-cushion maximum overage. The `dist`, `packed`, `collection`,
`query`, `query-development`, `all-exports`, `inspect`, and `external-atom`
budgets move to the measured values. The immutable ordinary baselines are not
regenerated. Three byte-identical pinned-Bun builds certify the runtime digest.

The raw ceiling for `atom-selector-store` is 66,284, and raw has no additive
allowance. This change leaves a 14-byte raw margin, so further core growth on
that fixture needs a raw-policy decision.

## Validation

An independent review found four defects in the first draft, and all four are
fixed with regressions:

- thrown-thenable inspection ran outside the capability guard;
- a post-apply failure could publish atoms alongside stale dependents;
- inspect dropped the reaction's result;
- the hotkey claims were overstated.

It also suggested exception-safe cleanup of pending state for the internal trace
seam; that is done too.
