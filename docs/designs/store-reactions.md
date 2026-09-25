# Store reactions (`store.sub` `settle` handlers)

Status: owner-approved and experimental during the beta. The failure policy,
error model, and inspect additions below are approved decisions, as are the
contract re-pins and the size budgets. The API was first a separate
`store.react` method; the owner then chose phase-keyed handlers on `sub`
([API revision](#api-revision-phase-keyed-handlers-on-sub)). The semantics are
unchanged. "Reaction" is the internal name for a `settle` handler.

## Problem

A command triggered by input — for example a keyboard shortcut read through an
`externalAtom` — needs to write application state. Ordinary subscribers may not
write the Store. A write deferred until after notification publishes twice:
observers first see the new input paired with the old result, and then the
result. Reactions put the command's writes inside the same settlement, before
ordinary notification.

## Decisions

- **API.** `store.sub(state, { settle?, notify? }): () => void`. `settle` is a
  `TransactionCallback`; `notify` is exactly the ordinary callback, and the
  function form `sub(state, callback)` is unchanged. One registration holds both
  handlers with `Store.sub` admission, validation, retention, and one idempotent
  unsubscribe. The object needs at least one handler and no other own keys; each
  present handler must be a function and is read once, `settle` first. Anything
  else throws `TypeError` after state validation. Registering never runs
  `settle`, including during admission catch-up, which still runs `notify`.
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
  needed, `SettleLimitError` / `VALDRES_SETTLE_LIMIT` is reported and no pending
  work survives the boundary.
- **Failures.** A throw, a thenable result, or a staging failure aborts only
  that reaction's draft. Earlier commits and the initiating update remain. A
  failure after apply keeps the writes and propagates them before delivery. If a
  selector's recomputation escapes the evaluator while a reaction's commit
  settles it, the escaped error becomes that selector's error outcome. The
  outcome keeps the selector's previous dependencies. Dependents settle against
  it in the same boundary and record the dependency edge, and the failure stays
  current until one of the selector's inputs changes, like any selector error.
  Re-evaluating on the next read instead would re-run the failed selector. It
  would also let a dependent read during a persistent fault cache a getter error
  with no edge to the failed selector: the evaluator records no edge for a read
  that throws. That error would outlive the fault. Two consequences follow.
  Recovery follows the failed selector's previous dependencies, and a
  transaction's `tx.get`, which evaluates against the draft, can compute the
  selector while `store.get` serves the failure. Thrown values are inspected
  under transaction-result guards. Failures are reported after the one delivery
  as `SubscriberNotificationError` causes, ahead of subscriber throws. Its
  frozen `phase: "notifying"` names the reporting boundary, not the moment each
  cause occurred.
- **Capabilities.** A reaction has transaction-callback capabilities only.
  Captured Store work, unsubscribe, and same-domain source invalidation stay
  rejected.
- **Inspect.** Each settle handler's commit is a `CommitInspection` row carrying
  `settle: true`, its `scope`, and its own `result`. A row triggered outside a
  Store operation has `operationId: 0`. `schemaVersion` stays 7: the fields are
  optional and additive.

## API revision: phase-keyed handlers on `sub`

The owner reviewed the naming after the first draft. A separate `react` method
read as a different mechanism, but it is a subscription with an earlier phase.
Prior art splits the same way: Angular's
`afterRenderEffect({ earlyRead, write, read })`, ProseMirror's
`appendTransaction` versus `view.update`, Lexical's node transforms versus
update listeners, Vue's `watch` `flush`, and Svelte's `$effect.pre`. The owner
chose phase-keyed handlers on `sub` over a `{ phase }` option and over a
`sub.settle` variant:

- `settle` names what the phase does: the update is still settling, and a
  handler may write so that the update settles with its result.
- `notify` names the existing phase. Keeping it as a key, not only as the
  function form, lets one registration own both halves of a command, and one
  unsubscribe remove them.
- `SubscribeFn`, the adapter-facing type, stays the function form: adapters only
  notify.

The change is surface-only. Both handlers live on one subscription registration:
`settle` is its `reaction` and `notify` its `callback`, so delivery, queueing,
admission, and removal need no new branches. The `core.store.react` contract
entry is removed; `core.store.sub` gains the handler notes and the contract IDs,
and `callback.store-reaction` becomes `callback.store-sub-settle` on
`core.store.sub`. The public names follow the phase: `ReactionLimitError` /
`VALDRES_REACTION_LIMIT` became `SettleLimitError` / `VALDRES_SETTLE_LIMIT`
(message "Store updates did not settle"), the inspect commit field
`reaction: true` became `settle: true`, and the `reaction.*` contract IDs became
`settle.*`. The internal host names keep "reaction".

## Size certification

A Store method is retained by every Store bundle, so the reaction machinery is
not tree-shaken. Measured on pinned Bun 1.4.0 against clean `main` (`a18963f9`):

| Fixture                                | main raw / gzip | reactions raw / gzip | Change        |
| -------------------------------------- | --------------- | -------------------- | ------------- |
| `atom-selector-store` (core-retaining) | 64,767 / 17,314 | 66,270 / 17,820      | +1,503 / +506 |

`atom-selector-store` was then 551 gzip bytes over its immutable 2% ceiling
(17,269), so the reviewed core-retaining allowance first rose from 77 to 551,
the exact no-cushion maximum overage at that point. The `dist`, `packed`,
`collection`, `query`, `query-development`, `all-exports`, `inspect`, and
`external-atom` budgets move to the measured values. The immutable ordinary
baselines are not regenerated. Three byte-identical pinned-Bun builds certify
the runtime digest.

The recomputation-failure fix (A2) adds 325 raw and 87 gzip bytes:
`atom-selector-store` becomes 66,595 raw and 17,907 gzip. The raw ceiling for
`atom-selector-store` is 66,284, and raw had no additive allowance, so this
change adds a reviewed `coreRetainingRawAllowance` of 311. That value is the
exact no-cushion raw overage, and it applies to the core-retaining fixtures the
same way the gzip allowance does. The gzip allowance rises from 551 to 638, the
new exact overage. The dependent feature budgets move to the measured values.
`atom`, `family`, `equality`, and `adapter-internals` are unchanged, and the
immutable ordinary baselines are not regenerated.

The API revision measured +124 raw and +49 gzip bytes on `atom-selector-store`
(66,719 / 17,956). Validating the handler object costs more than removing the
separate method saved. The owner approved raising the allowances to 441 raw and
688 gzip; the applied values are the exact no-cushion overages after the rename
to settle naming, 435 and 687. Accepting unknown keys would have saved 38 raw
and 19 gzip bytes, but a misspelled `notify` would then be dropped silently. The
dependent feature budgets move to the measured values, the runtime digest is
recertified, and the immutable ordinary baselines are not regenerated.

## Validation

An independent review found four defects in the first draft, and all four are
fixed with regressions:

- thrown-thenable inspection ran outside the capability guard;
- a post-apply failure could publish atoms alongside stale dependents;
- inspect dropped the reaction's result;
- the hotkey claims were overstated.

It also suggested exception-safe cleanup of pending state for the internal trace
seam; that is done too.

A focused revalidation then found that a selector recomputation failure inside a
reaction's commit could still leave cached descendants stale. The
failure-outcome contract above fixes it. Independent validation closed A2 with
notes. Two behaviours are unchanged and out of scope: a first-time dependency
failure is swallowed without an edge, and paths without a reaction still serve a
stale descendant after an escaped failure.
