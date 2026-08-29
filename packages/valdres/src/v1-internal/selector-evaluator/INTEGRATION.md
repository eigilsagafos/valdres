# Selector evaluator integration boundary

This directory is production-intent source for the Valdres 1.0 kernel, but it is
intentionally unreachable from every package entrypoint and from the beta.23
Store. The later kernel must integrate `evaluateSelector`; it must not copy or
fork the algorithm.

## Host responsibilities

All hosts make dependencies current before returning from `serve`, own outcome
token allocation, and atomically accept or reject the evaluator's immutable
proposal.

| Host                 | Records and currentness                                              | Control-error policy                                                              | Comparison baseline                                                          |
| -------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Persistent committed | Canonical forward/reverse graph and dirty routing                    | Reject before source apply; install exact authoritative control error after apply | Last successful committed value; canonical token only while currently served |
| Transaction scratch  | Generation-local forward memo only; no reverse graph or publication  | Exact throw, no memo/proposal installation                                        | Fixed committed last-success baseline plus current scratch success           |
| SSR/hydration        | Bounded disposable selector/source memo; no live graph or projection | Exact host-fatal throw, no live publication                                       | None; every selector is a first materialization                              |

The runtime-domain callback guard shares the top-level
`SelectorEvaluationSession`. It must call `latchControlFault` before throwing a
recognized `RuntimeMismatchError` (or another host-fatal hydration fault). A
caught mismatch therefore cannot become a value, comparator result, ordinary
error, family member, or prepared mutation.

## Required call ordering

For every supplied `get(dependency)`:

1. Reject active-stack recursion without calling the host.
2. Ask the host to make the dependency current.
3. Check the dependency's authoritative graph, substituting transient accepted
   prefixes for active selectors.
4. Capture its token and edge only when the proposal remains acyclic.
5. Serve its value or throw its error.

Owner validation happens before `serve` does dependency work, so a direct
foreign handle latches and throws without returning an outcome or edge. A
same-domain dependency whose authoritative current outcome is already a control
error is different: its valid token and edge are captured before that exact
error is rethrown to the parent.

The host may keep a successfully completed nested child even when the active
parent later returns an ordinary/control error. It may never install a partial
active-parent proposal or a foreign/offending edge.

## Explicit exclusions

This cluster owns no Store, transaction, scope, subscription, lifecycle,
external-source attachment, React/hydration adapter, reverse index, package
export, late dependency, Promise settlement, fixed-point cycle, cold validation,
or legacy-engine compatibility behavior. Store source epochs are not evaluator
freshness inputs. Meaningful performance gates begin only after a packed v1
Store driver integrates this module.
