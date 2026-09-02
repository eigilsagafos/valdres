# Selector evaluator integration boundary

This directory is production-intent source for the Valdres 1.0 kernel, but it is
intentionally unreachable from every package entrypoint and from the beta.23
Store. The later kernel must integrate `evaluateSelector`; it must not copy or
fork the algorithm.

## Host responsibilities

All hosts make dependencies current before returning from `serve`, own outcome
token allocation, and atomically accept or reject the evaluator's immutable
proposal. They expose a host-local monotonic selector-graph version. Every
selector-record installation increments that version exactly once and attributes
the same publication to the `SelectorEvaluationSession` that produced the
proposal; equal tokens and unchanged dependency sequences are still
publications. A selector-record removal or graph clear that can interleave with
an active evaluation must advance the same host version as well. A host may omit
that removal bump only when disposal/generation ownership makes interleaving
impossible. Selector-record absence is graph-closed: when
`getSelectorRecord(selector)` is `undefined`, no authoritative selector record
may depend on that selector. Selective removal must remove every incoming edge
needed to preserve that invariant; current persistent disposal and scratch
generation replacement instead clear an entire closed graph.

A host may expose an ordered selector-only adjacency lookup used exclusively by
closure proofs to avoid traversing terminal source nodes. `undefined` from a
supporting host identifies a terminal node and does not fall back to the full
record. Returned adjacency must preserve the exact node identity and relative
order of the authoritative dependency record. Active transient prefixes are
never filtered through this host cache. The persistent host builds each
subsequence lazily, reuses it only while the complete ordered node topology is
unchanged, and invalidates it when that topology changes; hosts that omit the
lookup retain the full-record traversal.

| Host                 | Records and currentness                                                               | Control-error policy                                                              | Comparison baseline                                                          |
| -------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Persistent committed | Canonical forward/reverse graph and dirty routing                                     | Reject before source apply; install exact authoritative control error after apply | Last successful committed value; canonical token only while currently served |
| Transaction scratch  | Generation-local forward memo and publication/version; no reverse or persistent graph | Exact throw, no memo/proposal installation                                        | Fixed committed last-success baseline plus current scratch success           |
| SSR/hydration        | Bounded disposable selector/source memo; no live graph or projection                  | Exact host-fatal throw, no live publication                                       | None; every selector is a first materialization                              |

The runtime-domain callback guard shares the top-level
`SelectorEvaluationSession`. It must call `latchControlFault` before throwing a
recognized `RuntimeMismatchError` (or another host-fatal hydration fault). A
caught mismatch therefore cannot become a value, comparator result, ordinary
error, family member, or prepared mutation.

## Required call ordering

For every supplied `get(dependency)`:

1. Reject active-stack recursion without calling the host.
2. Ask the host to make the dependency current.
3. If any intervening host publication came from another evaluation session,
   revalidate the accepted prefix in first-read order and truncate at its first
   newly offending edge.
4. Check a genuinely new dependency's authoritative graph, substituting
   transient accepted prefixes for active selectors. A cold-parent proof may be
   reused only when every intervening publication is attributed to this same
   session. A warm parent's new edge is always proved, including when serving
   that dependency first materializes it. An unaccepted old-direct edge may be
   reused only when no publication occurred since entry.
5. Capture its token and edge only when the proposal remains acyclic.
6. Serve its value or throw its error.

The evaluator repeats foreign-publication prefix revalidation after the getter
result is classified and after comparator classification. This closes the case
where user-controlled inspection or another host activity publishes after the
last supplied read but before the parent proposal is returned. Revalidation
continues after a cycle is latched so later topology changes can still shorten
the installed attempted prefix while the first cycle error keeps its identity.
Within one revalidation of one accepted prefix, negative closure proofs may
share a proposal-local bounded learner. A search publishes its existing
traversal map only after it exhausts without reaching the active selector. A
later first-read candidate may prune either of at most two proven-negative
closures without changing which edge is blamed or the canonical positive path.
The first observed reuse locks that closure and releases the other one. Three
disjoint non-terminal proofs disable learning, while terminal-only maps do not
evict a potentially useful closure. Once reuse is demonstrated, a hit resets the
locked closure's miss streak; two consecutive disjoint non-terminal proofs are
tolerated and the third disables learning. The learner is discarded after that
exact graph observation; it is never reused across a publication or a later
prefix-revalidation call.

```text
foreign graph publication
  -> accepted dependencies, still in first-read order
       -> search, pruning up to two learned negative closures
            -> no path with overlap: lock the reused closure
            -> no path without overlap: learn, retain, or disable by the bound
            -> path: publish nothing; keep the existing canonical path
```

The session's active transient frame holds a read-only alias to the evaluator's
proposal-local dependency prefix. The evaluator is its only writer, so every
accepted append and prefix truncation is visible to cycle traversal as one
atomic carrier change rather than two synchronized mutations. When a nested
frame observes a foreign publication, the session revalidates active ancestor
frames outermost-first before the nested frame proves another edge. Each frame's
registered revalidator truncates its own aliased prefix, so a child proof never
traverses an ancestor edge that was already invalidated by the new topology.

Same-session publication reuse follows from one invariant: the installed graph
plus every active frame's accepted transient prefix remains a DAG. A nested
selector evaluated through that frame stack sees those transient parent edges
during its own closure proof, so it cannot invalidate an already-accepted
prefix. A fresh-session settlement cannot see those edges and must therefore be
detected by the host-version/session-attribution delta and followed by full
prefix revalidation. Publication attribution is host-qualified; activity in a
second scope or scratch host cannot cancel a fresh publication in the active
host. Active-frame identity is likewise the `(host, selector)` coordinate:
active-cycle lookup, transient-prefix substitution, prefix truncation, cycle
latching, and ancestor revalidation ignore frames from other hosts sharing the
same session. A selector identity reused by two hosts therefore cannot create a
cross-host false cycle.

The persistent host settles a selector's old committed dependencies in their
established order and in isolated sessions before serving that selector during
propagation. It may reuse the caller's active session for the requested selector
only when this administrative pass did not advance the host graph version. If an
old dependency published, the requested selector keeps a fresh session so the
caller observes that foreign publication and revalidates its prefix. This gate
preserves notification order and first-control-fault identity while attributing
a directly nested target's own publication to the active evaluation.

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
