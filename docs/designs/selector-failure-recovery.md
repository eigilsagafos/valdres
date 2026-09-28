# Selector failure recovery

## Problem

Two defects remained after `store.sub(state, { settle, notify })` (#408).

A selector that read a dependency whose evaluation escaped (threw out of the
host instead of returning an error outcome) cached its own getter error without
an edge to that dependency. Collection queries reach this publicly: the first
read of a query materializes its index, and an extractor that rejects an
existing row escaped that materialization. The reading selector stayed failed
after the row was repaired, until one of its other inputs changed.

A selector re-evaluation that escaped during a write, transaction, external
invalidation, or dormant external read aborted or skipped its branch. The failed
selector stayed dirty, its cached dependents were never marked, and reading a
cached dependent first served a value computed before the write. #408 fixed this
only inside `settle` commits.

## Fix

The committed host publishes every escaped selector evaluation where it installs
proposals (`StoreScopeNode.serveKnownLocal`). An ordinary escape becomes the
selector's exact error outcome with the dependencies the failed attempt
proposed, which the evaluation session exposes only once the evaluator built a
proposal, or else the previous ones. Readers record the edge and dependents
settle against the failure in the same boundary. After sources apply, a control
fault latched in the session is installed as the selector's exact control
outcome instead, so it is never demoted to an ordinary error; before they apply,
the evaluation is rejected without publication (see the deferred case below).

A failure with neither dependency list, a first evaluation that escaped before
reading anything, is published for a reading parent. A later settlement boundary
re-attempts it once when a dependent reads it again. Its retry mark records the
boundary that published it, so lifecycle catch-up waves and `settle` commits of
that boundary never re-attempt it, and dependents that stop reading it neither
re-attempt nor report it. A top-level first read with nothing holding it still
rethrows uncached.

The settlement that caused the failure reports it after it has propagated and
notified: a `settle` commit through its handler, as before; an external
settlement through its operation; an owned write by throwing it exactly as it
escaped when it is alone, or with the authoritative control fault first and
other failures as causes of a `SubscriberNotificationError`.

A query whose first materialization fails serves that failure as its outcome and
registers for its collection, unless the reading evaluation latched a control
fault, which is rethrown uncached. The next committed change to that collection
in that scope drops the failure and republishes the query, so dependents re-read
and rematerialize it.

## Approved behavior changes

- An applied write publishes coherent state and error outcomes, and notifies,
  before it reports an escaped evaluation failure.
- Readers of a failed first query materialization receive a
  `SelectorDependencyError` on the query instead of a bare getter error.
- Ordinary query materialization failures are cached, keep their readers'
  dependency, and are retried on the next committed change to that collection in
  that scope. Repeated reads no longer rerun extractors.
- A dependency's first-read failure during a write is reported by that write.
- A failure with no known input is re-attempted at most once per top-level
  settlement, and only when a dependent reads it again.
- After apply, a latched control fault is installed through the failed branch
  and leads the aggregated causes.

## Deferred: pre-apply control precedence

Before sources apply, an evaluation that latches a control fault and then
escapes is rejected correctly: nothing is published, a transaction's staged
writes roll back, no subscriber is notified, and later operations recover. The
surfaced error, however, is the escaped error, not the latched control error.
This predates this change (it reproduces on `7c0aba86`) and is deferred.

Reproduction, through the internal evaluation seam:

```ts
const domain = createCommittedStoreTreeDomain()
const other = createCommittedStoreTreeDomain().atom(10)
const middle = domain.selector(get => get(other), { name: "middle" })
const escape = new Error("after control evaluation escape")
const trace = Object.assign(() => {}, {
    evaluate: (...args) => {
        const proposal = evaluateSelector(...args) // latches the mismatch
        if (args[0].node === middle) throw escape
        return proposal
    },
})
const store = domain.createStoreTree(undefined, trace)
store.get(middle) // throws `escape`; expected the latched RuntimeMismatchError
store.txn(tx => tx.get(middle)) // same at the scratch host
```

Follow-up: when rejecting a pre-apply escape, throw the session's latched
control error if one exists (`StoreScopeNode.publishEscapedFailure`), and apply
the same precedence where the scratch host evaluates
(`scratch-selector-host.ts`). Keep the existing no-publication and rollback
behavior. Add direct-read and transaction-read regressions asserting `===`
identity with the latched control error, rollback, and zero notifications.

## Accepted limitations

- A failure with no known input stays cached for direct reads after every
  dependent has dropped it, even once the fault clears. It recovers when a later
  settlement re-reads it for a dependent. Only the internal evaluation seam
  produces such an escape.
- Stack exhaustion in deep selector chains (a cold read, or the recursive
  settlement walk) can still cache an edge-less failure or throw after commit.
  This predates this change and needs iterative evaluation; it is deferred.
- A Store-accessor capability fault inside an extractor latches only the
  extractor's own callback session, so readers see an ordinary error, as before,
  and the query caches it like any extractor failure.
- A query whose materialization failed keeps its index activation, so writes to
  that collection in that scope do delta work until it is retried.

## Size certification

Measured on pinned Bun 1.4.0 against clean `main` (`7c0aba86`), which sat
exactly at both core-retaining ceilings:

| Fixture                                | main raw / gzip  | branch raw / gzip | Change        |
| -------------------------------------- | ---------------- | ----------------- | ------------- |
| `atom-selector-store` (core-retaining) | 66,723 / 17,960  | 67,865 / 18,252   | +1,142 / +292 |
| `query`                                | 106,406 / 30,156 | 108,195 / 30,674  | +1,789 / +518 |

The owner approved total allowances of 1,581 raw and 983 gzip, the exact
no-cushion overages. The `dist`, `packed`, `collection`, `query`,
`query-development`, `all-exports`, `inspect`, and `external-atom` budgets move
to the measured values, and the runtime digest is recertified. The immutable
ordinary baselines and the `atom`, `family`, `equality`, and `adapter-internals`
entries are not changed, although the emitted `atom`, `family`, and
`adapter-internals` fixtures grow within their existing ceilings.
