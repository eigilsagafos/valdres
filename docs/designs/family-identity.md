# Identity-only `family()`

Status: implementation candidate; ShiftX migration evidence pending.

## Scope

`family(createNode, { encodeKey? })` is a definition factory, not Store state.
It memoizes one Atom or Selector per non-empty ordered primitive tuple. Every
position uses `SameValueZero`; arity, order, primitive type, and Symbol identity
remain significant. Structured arguments require an explicit synchronous
`encodeKey` returning one primitive `FamilyKey`.

The family callable has no membership, enumeration, deletion, release, Store,
scope, transaction, index, or collection surface. Collection semantics remain a
separate lake.

## Ownership and lifecycle

Each family owns a primitive-key tuple trie whose terminal values are weak.
Finalization removes only the exact registered generation and prunes empty
routes. A lookup repairs a dead weak reference synchronously, so correctness
does not depend on finalizer timing.

A successfully committed family Atom override is mirrored by one private strong
pin in that exact Store scope. Reset and explicit scope/Store disposal release
the pin. Equal-value ownership shadows still pin because they create an owned
scope coordinate. Transactions add pins only after successful validation and
commit. Active subscriptions and retained selector dependency snapshots already
provide their existing strong ownership; standalone cold records remain weak.
The pin Set is not family membership and is never enumerable.

The factory must construct its returned State in the active family construction
frame or return any already-published family member. This preserves the promised
weak identity while any Store record retains an Atom without adding a reverse
owner index to every ordinary Atom write.

## Callback boundary

Factories and encoders are synchronous and run under the definition callback
quarantine. Factories may construct immutable State definitions and call family
accessors, including the same family at a different identity. Encoders are pure
canonicalization: Store work, State construction, and calls to any family
reject. Returned or thrown thenables are contained and reject synchronously. A
factory or encoder cannot borrow an active selector-supplied `get`; the first
exact capability fault stays sticky even when user code catches it. A failed,
invalid, recursive, or foreign construction creates no cache entry.

## Alternatives considered

1. **Accept any pre-existing State and reverse-index every Store override.**
   Rejected. It adds work and retention metadata to every ordinary Atom write so
   an uncommon family alias can discover old owners retroactively.
2. **Hold all family members strongly for the family lifetime.** Rejected. It
   leaks high-cardinality context-keyed members and requires a release API that
   would recreate the old family/membership coupling.
3. **Let Store overrides stay weak and recreate a collected family Atom.**
   Rejected. Reacquisition could silently lose the committed value and expose
   the Atom fallback.
4. **Reuse legacy atomFamily/selectorFamily caches.** Rejected. They combine
   identity with structural encoding, membership, enumeration, deletion,
   release, and indexes.
5. **Hide retention metadata inside `atomOverrides` or reuse unrelated Symbol
   slots.** Rejected after measurement. The small byte saving makes ownership
   less explicit without changing the historical size-gate result.
6. **Change every guarded callback to reject a borrowed selector `get`.**
   Deferred. The existing core explicitly supports lazy-initializer re-entry;
   this slice enforces only the new family factory/encoder boundary rather than
   silently changing that established callback behavior.

## Work and package gates

Internal counters freeze retention Set allocation, distinct retains, and
explicit releases. Ordinary Atom writes and cold family reads must leave all
three at zero. The packed atom-only fixture must contain no family cache or
accessor sentinel; only the small Store ownership/quarantine seam is shared.

On pinned Bun 1.4.0, the hardened candidate adds 1,076 raw / 354 gzip bytes to
the atom-only fixture versus the freshly rebuilt beta.28 artifact (+2.08% /
+2.61%). The cache/accessor implementation itself still tree-shakes away; that
delta is the construction quarantine, lifecycle pin, exact work counters, and
the selector-capability guard. Prototypes that preserved domain/session
encapsulation saved at most 32 gzip bytes; a module-global guard saved 82 gzip
bytes but coupled independent runtime domains and custom evaluators, so it was
rejected. The family seam intentionally exceeds the ordinary 2% ratchet by
0.61 percentage points, so release review records and ratchets the reproducible
beta.28 delta rather than trading away lifecycle semantics for byte-budget
headroom.

Before release, replace one ShiftX identity shim with this API and verify the
same graph shape, values, notifications, and transaction boundaries. The family
beta must remain separate from the cold-drop performance beta so either change
can be rolled back and measured independently.
