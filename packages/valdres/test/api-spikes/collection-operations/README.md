# Collection index-operations spike

This directory is a test-only prototype for the operational lifecycle of a
structural index. It imports no Valdres production source and proposes no public
package or method names.

```text
v1 collection reference model
     raw checkpoint                 effective row deltas
          |                    upstream guarded preparation*
          |                              |
          v                              v
 cancellable baseline scan      prepared value/index keys
          \______________________________/
                         |
                private candidate
                         |
                 atomic publication

* represented by a test fixture here; see the limitation below
```

Collection rows, scopes, transactions, tombstones, overrides, membership order,
and `EffectiveRowDelta` remain owned by `test/v1-model`. The operational machine
never mutates those rows and has no parallel Store or transaction engine.

## Evidence this spike provides

- explicit `unmaterialized -> building -> ready | failed | cancelled` states;
- one stable wakeable for deduplicated concurrent demand;
- manually stepped, cancellable baseline scans whose private candidate may run
  the index projector and fail without publication; an explicitly shared test
  domain blocks cross-instance operational re-entry, a caught violation still
  poisons callback output, and ownership is rechecked after user code;
- one runtime admission rule requires primitive string keys from baseline
  projection, prepared deltas, scope overlays, and artifacts; async-shaped
  values are rejected and given a rejection handler before failure, while thrown
  values become fixed phase-specific messages without diagnostic reflection,
  message getters, `instanceof`, or `toString`; thenable admission may inspect
  `.then` only inside the guarded callback boundary;
- post-commit ingestion of definition-bound prepared keys with zero projector
  invocation inside `recordCommit`;
- one commit batch applies non-inserts first, then inserts in ascending
  `birthSequence`, independent of incoming delta-array order, after validating
  keys, outcome/key presence, birth sequences, and row uniqueness;
- concurrent epochs journal during scanning and reconcile before one initial
  atomic publication;
- a zero-relevant epoch advances gap detection without replacing the published
  content snapshot;
- retry after build failure/cancellation using an authoritative checkpoint that
  cannot precede any epoch already observed from the target tree, including an
  epoch whose prepared commit or artifact plan was rejected, plus terminal
  disposal;
- wakeable fulfillment/rejection installs ready/failed/cancelled/disposed state
  first, snapshots and runs every listener, then synchronously surfaces the
  first listener error; one listener cannot starve another or reopen disposal;
- monotonic per-generation progress and consumed epochs;
- artifacts bind to collection identity, definition fingerprint, and a portable
  logical row/value checkpoint—not StoreTree, scope, membership-snapshot, or
  local-epoch identity;
- an older artifact can remain a private candidate, replay supplied prepared
  commits, and promote only after matching the target logical checkpoint;
- a host-prepared, row-preconditioned base-scope transformation starts from the
  portable artifact candidate, validates its prepared keys, and reconciles it to
  the target scope at the artifact-era checkpoint before later commits replay;
  the importer neither reads Store internals nor invokes the projector;
- artifact promotion is monotonic for an already-ready instance: an older target
  is rejected, while reconciliation to identical current content is an
  exact-reference no-op rather than a replacement;
- value-only changes under unchanged keys and bucket order advance internal
  validation state without replacing the observable snapshot or publishing an
  index-content event;
- corrupt artifacts and incomplete/stale reconciliation publish nothing; and
- root/child behavior comes from effective tombstone and override deltas.

## Not proven or frozen here

The test fixture prepares delta keys after the reference-model source commit. It
only stands in for the intended upstream guarded preflight. Therefore this spike
does **not** prove that a real index extractor failure aborts the collection
commit, nor does it freeze where canonical delta/key preparation lives. A
production prototype must prepare all throwing extractor work before source
apply and pass inert prepared deltas into this operational machine.

The fixture also prepares a complete row-preconditioned transformation after
reading a reference-model checkpoint. This proves that child overrides and
tombstones can be reconciled from artifact data without a second mutation
engine, but does **not** settle the production owner, canonical preflight
boundary, or persistence representation for that transformation.

The artifact is an in-memory semantic record, not a production wire format.
Canonical bytes, schema/version negotiation, value codecs, checksum/security
properties, definition-fingerprint generation, persistence ownership, and
cross-version compatibility remain unresolved. The manual scheduler also does
not choose production priority, worker ownership, callback-domain ownership,
persistence, or resumption policy. Query grammar, public naming, and
query-result notification semantics remain outside this spike.

Run the isolated proof with:

```sh
bun run --cwd packages/valdres spike:collection-operations
```
