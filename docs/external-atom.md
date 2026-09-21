# ExternalAtom reference

`externalAtom` defines read-only State backed by synchronous truth owned outside
Valdres. Import it and its three public types from `valdres`:

```ts
import type { ExternalAtom } from "valdres"

interface ExternalSource<T> {
    readonly getSnapshot: () => T
    readonly getServerSnapshot?: () => T
    readonly subscribe: (invalidate: () => void) => () => void
}

interface ExternalAtomOptions {
    readonly name?: string
}

// externalAtom<T>(source: ExternalSource<T>, options?: ExternalAtomOptions): ExternalAtom<T>
```

The interfaces above describe the exported types; import them in application
code rather than redeclaring them. `ExternalAtom<T>` is a `State<T>` with
`kind: "external"`. Store reads, subscriptions, selectors, and React `useValue`
accept it. Store/Transaction writes, reset, delete, and writable React hooks
reject it, including JavaScript calls that bypass TypeScript.

## Definition and source contract

Every call creates a fresh immutable definition, even for the same source
object. Share the definition when consumers should share its identity.

The source must be a non-null, non-array object. Class instances and inherited
methods are supported. Construction reads `getSnapshot`, `getServerSnapshot`,
then `subscribe` once, in that order, and captures the methods with the original
source as their receiver. It does not call them. Required methods must be
functions; the optional server method may be absent or `undefined`.

The optional options object accepts only an optional string `name`. Unknown own
keys, including symbols and non-enumerable keys, are rejected. The name is inert
diagnostic metadata. There is no custom comparator, publisher, writable cell,
scheduler, or asynchronous source option.

`getSnapshot` returns the current value synchronously. Keep the same reference
while the value is unchanged: publication uses `Object.is`. Ordinary thrown
values become exact snapshot error outcomes. Returned or thrown thenables are
contained and converted to `InvalidSynchronousExternalSnapshotError`; they do
not enable Suspense.

`subscribe(invalidate)` installs a listener and must synchronously return a
cleanup function. Update the external truth before calling the zero-argument
invalidator. Each retained StoreTree/definition pair has at most one source
subscription, shared across its scopes and selector consumers. Separate root
Stores subscribe independently. Setup is followed by a catch-up sample, so an
update during setup is observed. Setup may call its own invalidator.

The last retained consumer releases the source subscription. Cleanup runs once
per attached generation, including disposal and partial setup rollback. Old
invalidators become harmless after their generation detaches. Cleanup must be
synchronous; returned thenables are invalid. A throwing cleanup still releases
ownership and does not prevent other cleanup callbacks from running.

Source methods, cleanup, and their thenable accessors are guarded callbacks:
they cannot call same-domain Store/Transaction capabilities or borrow an active
selector's `get`. Pure State definition construction and wholly foreign-domain
operations retain their ordinary allowances. Borrowed selector reads and other
latched control faults remain fatal even if caught; an ordinary capability
rejection may be caught by the source. Subscription callbacks retain the
existing subscriber read capabilities, but sampling a dormant ExternalAtom from
one throws `DormantExternalReadError`.

## Reads, transactions, and family

A dormant read samples the source without attaching. A retained read serves the
installed outcome in constant time without sampling or traversing the lifecycle
graph. Invalidation publishes synchronously, settles dependent selectors, and
notifies subscribers. Reentrant invalidations enter a bounded dirty drain.
Work-limit errors leave the source eligible for a later retry; they never
schedule background retries.

Scopes observe the same StoreTree projection. A transaction captures each
distinct ExternalAtom at most once across its scopes and scratch evaluations. An
external change after that capture is observed by subsequent live work, not by
another read of that identity in the same transaction.

`family` accepts an ExternalAtom created in its active factory frame, or a
member already published by a same-domain family. Arbitrary pre-existing States
and collection States remain invalid factory results. Family identity is weak;
Store-owned family reacquisition remains Atom-only.

```ts
import { externalAtom, family } from "valdres"

const metric = family((name: string) =>
    externalAtom(
        {
            getSnapshot: () => name.length,
            subscribe: () => () => {},
        },
        { name },
    ),
)
```

## Server rendering and hydration

React's hydration reader uses `getServerSnapshot` for every reached
ExternalAtom. A server read never falls back to the live reader. Its disposable
evaluation host memoizes each reached identity and selector once, creates no
live subscription or retained graph, and caches either the resulting value or
the thrown outcome for that React reader closure. A Store or State rebind gets a
fresh closure. Every call checks Store liveness, even after caching a result.

Use equivalent serialized server data for server rendering and initial client
hydration. Cross-process object identity is unnecessary. Give each request its
own Store and request-bound source data. After hydration, live reads and the
subscription catch-up observe the current client value. See the
[integration guide](howto-external-atom.md#how-to-render-and-hydrate-external-state).

## Errors and immutable metadata

All listed error objects are frozen. Metadata arrays and failure records are
also frozen; application-thrown cause objects retain their original identity and
are not frozen by Valdres.

| Error                                     | `code`                                          | Additional metadata                                                                                             |
| ----------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `InvalidSynchronousExternalSnapshotError` | `VALDRES_INVALID_SYNCHRONOUS_EXTERNAL_SNAPSHOT` | Used for both live and server snapshots                                                                         |
| `ServerSnapshotUnavailableError`          | `VALDRES_SERVER_SNAPSHOT_UNAVAILABLE`           | `dependencyPath`: frozen array of exact State handles, requested target through missing ExternalAtom, inclusive |
| `DormantExternalReadError`                | `VALDRES_DORMANT_EXTERNAL_READ`                 | None                                                                                                            |
| `InvalidExternalCleanupError`             | `VALDRES_INVALID_EXTERNAL_CLEANUP`              | `phase`, `source`, `committed`                                                                                  |
| `ExternalSourceNonConvergenceError`       | `VALDRES_EXTERNAL_SOURCE_NON_CONVERGENCE`       | `phase`, `source`, `committed`                                                                                  |
| `ExternalSourceDeliveryLimitError`        | `VALDRES_EXTERNAL_SOURCE_DELIVERY_LIMIT`        | `phase`, `source`, `committed`                                                                                  |
| `ExternalSourceOperationError`            | `VALDRES_EXTERNAL_SOURCE_OPERATION`             | `failures`, `causes`, `cause`, `phase`, `source`, `committed`                                                   |
| `SubscriberNotificationError`             | `VALDRES_SUBSCRIBER_NOTIFICATION`               | `causes`, first `cause`, `phase: "notifying"`, `committed: true`, `source`                                      |

Pure notification failures use `SubscriberNotificationError`, after all eligible
callbacks run. Its source is `owned-mutation`, `external-read`,
`external-startup`, `external-invalidation`, or `external-drain`.

Mixed-phase and setup/cleanup aggregation uses `ExternalSourceOperationError`.
Each `failures` entry contains `{ cause, phase, source, committed }` in
occurrence order. Repeated throws of the same object remain separate entries.
`causes` contains those exact causes, and top-level metadata describes the first
entry. Phases are `admitting`, `sampling`, `settling`, `notifying`, `cleanup`,
and `instrumenting`; sources additionally include `external-cleanup`. Directly
thrown lifecycle/work-limit errors carry the same operation metadata.

Direct control-error escape belongs to the current runtime occurrence. Throwing
an application-created public error, or rethrowing a runtime error captured in a
previous setup/cleanup callback, produces an operation wrapper with that exact
object as its cause. Catching a nonsticky capability guard still handles it.

The `ExternalSourceOperationError` constructor requires a readonly nonempty
failure tuple. JavaScript callers passing an empty list receive a `TypeError`
with message `ExternalSourceOperationError requires at least one failure`.
The constructor preserves input order and freezes copied metadata, leaving the
application's cause objects unchanged.

## Inspection

`valdres/inspect` records opaque `external` references, diagnostic names, and
flat external work counters. Optional `external-source` detail rows describe
sampling, attachment, detachment, invalidation, publication, drains, and work
limits. Isolated server/transaction observations contribute counters without
projected lifecycle detail rows. Reports retain no snapshots, source objects,
callbacks, application errors, or live State handles. Normal and inspectable
React bindings follow the same hydration and lifecycle contract.

See [the integration guide](howto-external-atom.md) for runnable examples and
[the implementation design](designs/external-atom-implementation.md) for the
projection, transaction, and lifecycle rationale.
