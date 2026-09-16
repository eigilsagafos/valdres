# Valdres v1 reference model

This directory is the executable semantic oracle for contract rows that are
already approved. It is test-only and imports nothing from `src/` or from a
published Valdres runtime.

The implementation is intentionally unlike the planned production kernel:

- definitions and Stores are symbolic IDs rather than runtime handles;
- symbolic IDs reject the model's reserved NUL tuple separator, and observable
  draft/synthetic tokens use injective, generation-specific identities;
- values are tagged tokens, preserving `undefined`, `NaN`, signed zero, bigint,
  and reference identity without JSON coercion;
- a transaction is an append-only intent log whose reads scan ancestors;
- commits collapse final intents and recompute every affected scope by brute
  force;
- collection membership and effective row deltas are recomputed from final
  outcomes, not maintained by an index or routing graph.

That independence is the point. A later candidate driver will translate the same
semantic commands to the public runtime and compare observable traces.

```text
contract IDs + disposition owner IDs
                  |
                  v
       serializable commands
            /             \
           v               v
  slow reference model   future packed runtime driver
           |               |
           v               v
     expected trace  <=> actual trace
```

## Implemented slice

- exact Atom values and `Object.is` defaults;
- lazy fallback identity per committed StoreTree;
- parent-local named scopes, fresh anonymous scopes, live inheritance, reset,
  and deterministic postorder disposal;
- one flat same-tree transaction draft, symbolic reset, fixed-entry comparator
  baseline, staged updater reads, caught-operation behavior, and final-state
  notification selection;
- collection row identity, explicit absence/presence, scoped tombstones,
  existing-only update, effective insertion order, stable membership snapshots,
  and commit-final effective row deltas.

Alongside that Store/transaction model, `selector-oracle.ts` is a deliberately
separate brute-force symbolic oracle for the approved pure selector semantics.
It covers ordered dependency capture, graph replacement, direct/indirect and
prior-record cycles, offending-edge exclusion, ordinary errors, `Object.is`, and
last-success comparator canonicalization. The production-intent evaluator is
tested differentially against it but never imports it.

For a baseline-absent row that becomes present through more than one final scope
intent, its insertion sequence is the latest required enabling intent on the
final target-to-owner path. Thus both `child reset -> root set` and
`root set -> child reset` append at the second operation. Overwritten/no-op
intents and present-to-present changes never reorder an existing member.

## Deliberately not implemented yet

The Store/transaction `ReferenceModel` itself still has no selector cache or
graph. Runtime-domain validation, React, query grammar, production structural
indexes, and the beta cache companion remain outside this slice. In particular, `EffectiveRowDelta` is
a test-model observation, not a frozen production ABI. The separate
`test/api-spikes/collection-operations` prototype consumes its canonical
before/after semantics without adding another mutation or transaction engine;
that prototype does not make this model depend on index code.

## External-source protocol and model

`external-protocol.ts` and `external-model.ts` add a separate source-independent
external observation/lifecycle oracle. Definitions, scopes, errors, and source
callbacks are symbolic; scripts remain replayable without JavaScript closures.
It reuses tagged values and the selector oracle's Object.is equivalent, and
imports no production runtime. Strong maps and scans deliberately differ from
the planned weak routes and sparse production lifecycle plane.

The model covers dormant and retained observations, scope-transparent projection
identity, independent trees sharing a source, provisional attachment and mandatory
catch-up, ordered bounded dirty drains, cleanup, disposal, transaction capture
across scopes/generations, isolated server reads, and callback quarantine. A small
expression vocabulary covers dynamic dependencies, equal-result topology changes,
and caught faults; the existing selector oracle remains responsible for full
selector error/cycle/comparator semantics. Symbolic errors are not public class or
code approvals. Public decisions are pending in
`docs/designs/external-atom-implementation.md`.

`ExternalProtocolDriver` is the comparison seam for later unexported and packed
runtime drivers. The current seeded direct-source differential campaign compares
3,200 operations with an independent scalar specification. Adversarial tests pin
trace order, sample/capture identities, rollback, partial-round exhaustion,
cross-tree entry limits, and later retry. Production differential drivers, weak
retention/GC, foreign-runtime ownership, full source capability matrices, React,
and package certification remain later slices; this oracle does not certify them.

The frozen counter vocabulary distinguishes samples, captures, publications,
lifecycle operations, delivery, and containment. Oracle counters count logical
events; its exhaustive scans are not production performance measurements. Drain
and source-delivery numbers are internal engineering defaults, not public timing
promises.

Run:

```sh
bun run --cwd packages/valdres test:v1-model
```
