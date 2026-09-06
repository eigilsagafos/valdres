# Packed v2 admission audit

This is scope and executability evidence, not tournament eligibility or a green
control bundle. All admissions used the already verified shipping beta.36 timed
tarball; no source runtime or synthetic TestHost was imported.

The preserved raw records and reproduction script are at:
`/Users/eigilsagafos/.gstack/projects/eigilsagafos-valdres/selector-kernel-tournament/foundation-development/v2-admission`

`SHA256SUMS` SHA-256:
`9e683b8a50bbc6894d1820dde31cfda0aee660db2ce414fbe83f7c84ef9b77bd`.

The root/adapter public probe ran successfully under Node 24.16.0 and Bun 1.4.0.
The three core-load probes ran the unchanged `run-sample.mjs` in `oracle` mode
with the frozen main fixture, `v1` adapter, and each existing scenario. The
initial-view module loads its own frozen initial-view parameters. All 900
no-writes lifecycle steps remain in the existing workload.

## Complete inventory

| ID                                | Admission  | Public stimulus                                                         |
| --------------------------------- | ---------- | ----------------------------------------------------------------------- |
| `C-GRAPH-001`                     | Node + Bun | exhaustive labeled DAG edge insertion                                   |
| `C-CYCLE-001`                     | Node + Bun | direct active recursion                                                 |
| `C-CYCLE-002`                     | Node + Bun | indirect active recursion                                               |
| `C-CYCLE-003`                     | Node + Bun | cached dynamic reversal                                                 |
| `C-CYCLE-004`                     | Node + Bun | cached multi-hop dynamic cycle                                          |
| `C-CYCLE-005`                     | Node + Bun | caught cycle remains sticky and blocks later get                        |
| `C-STORE-001`                     | Node + Bun | source commit remains final after derived failure                       |
| `C-TXN-001`                       | Node + Bun | scratch transaction abort publishes nothing                             |
| `C-SUB-001`                       | Node + Bun | synchronous single final notification                                   |
| `C-SCOPE-001`                     | Node + Bun | same selector identity remains host-local                               |
| `A-GRAPH-001`                     | Node + Bun | causally closing edge owns blame and is excluded                        |
| `A-GRAPH-002`                     | Node + Bun | maximal earlier acyclic prefix is retained in read order                |
| `A-GRAPH-003`                     | Node + Bun | fresh-session settlement and later rewrites preserve the accepted graph |
| `A-GRAPH-004`                     | Node + Bun | same-session publication sees transient ancestor prefix                 |
| `A-GRAPH-005`                     | Node + Bun | finalization quarantine protects the accepted prefix after the last get |
| `A-GRAPH-006`                     | Node + Bun | valid completed child survives failed parent                            |
| `A-CURRENT-001`                   | Node + Bun | current outcome avoids body entry and stale outcome recomputes          |
| `A-ERROR-001`                     | Node + Bun | cycle error identity is sticky within evaluation                        |
| `A-ERROR-002`                     | Node + Bun | unchanged current ordinary error preserves identity                     |
| `A-EQUAL-001`                     | Node + Bun | last-success comparator baseline and equality pruning                   |
| `A-FAULT-001`                     | Node + Bun | thenable rejection containment and comparator control-fault precedence  |
| `A-TXN-001`                       | Node + Bun | scratch generation currentness commit and abort                         |
| `A-SCOPE-001`                     | Node + Bun | scope-qualified records inheritance disposal and recreation             |
| `A-SUB-001`                       | Node + Bun | first-reaching and insertion notification order                         |
| `A-SUB-002`                       | Node + Bun | subscriber callback fault isolation and quarantine                      |
| `A-HYDRATE-001`                   | Node + Bun | same-domain synchronous hydration parity and disposable-host isolation  |
| `A-DOMAIN-001`                    | Node + Bun | runtime mismatch before work across every host                          |
| `A-FAMILY-001`                    | Node + Bun | family-created atoms and selectors remain ordinary same-domain states   |
| `A-FAMILY-002`                    | Node + Bun | family definition callback quarantine rejects borrowed supplied reads   |
| `A-FUZZ-001`                      | Node + Bun | deterministic dynamic differential traces                               |
| `P-NEG-ATOM-2048`                 | Node + Bun | negative-control                                                        |
| `P-FANOUT-128`                    | Node + Bun | stable-fanout                                                           |
| `P-FANOUT-512`                    | Node + Bun | stable-fanout                                                           |
| `P-FANOUT-2048`                   | Node + Bun | stable-fanout                                                           |
| `P-REWIRE-SEPARATE-181-18`        | Node + Bun | rewire-separate-commits                                                 |
| `P-REWIRE-SEPARATE-800-2`         | Node + Bun | rewire-separate-commits                                                 |
| `P-REWIRE-TXN-181-90`             | Node + Bun | rewire-single-transaction                                               |
| `P-REWIRE-TXN-800-400`            | Node + Bun | rewire-single-transaction                                               |
| `P-GRAPH-FWD-WIDE-2048`           | Node + Bun | dual-graph-shape                                                        |
| `P-GRAPH-REV-WIDE-2048`           | Node + Bun | dual-graph-shape                                                        |
| `P-CORE-INITIAL-VIEW`             | Node       | unchanged packed core-load workload                                     |
| `P-CORE-WRITES`                   | Node       | unchanged packed core-load workload                                     |
| `P-CORE-NO-WRITES`                | Node       | unchanged packed core-load workload                                     |
| `P-SCOPE-1000`                    | Node + Bun | scope-routing                                                           |
| `P-SUB-CHURN-100`                 | Node + Bun | subscription-lifecycle                                                  |
| `P-SCRATCH-SET-READ`              | Node + Bun | transaction-scratch                                                     |
| `P-HYDRATE-2048`                  | Node + Bun | hydration                                                               |
| `M-ATOM-ONLY-STORES`              | Node + Bun | atom-only stores                                                        |
| `M-LIVE-SELECTOR-GRAPHS`          | Node + Bun | live selector graphs                                                    |
| `M-DYNAMIC-DEPENDENCY-CHURN`      | Node + Bun | dynamic dependency churn                                                |
| `M-SCOPE-CREATION-DISPOSAL`       | Node + Bun | scope creation and disposal                                             |
| `M-SINGLE-STORE-TRANSACTIONS`     | Node + Bun | single-store transactions                                               |
| `M-DEEP-CROSS-SCOPE-TRANSACTIONS` | Node + Bun | deep cross-scope transactions                                           |

## Factual corrections from the complete audit

- Active-cycle raw paths start at the dependency; cached rejection raw paths
  start at the blamed parent. Raw traces retain that distinction. The neutral
  graph invariant uses a closed-path rotation, preserving every edge.
- Same-domain public operations cannot create the TestHost-only nested
  publication stimulus during a callback. `A-GRAPH-003` uses the reachable
  committed-Store closure-settlement trace; `A-GRAPH-005` covers finalization
  quarantine after the last supplied get. Existing synthetic tests are frozen.
- Legacy `defaultValue` access is replaced by the known atom initial value.
  Scope `detach()` is replaced by the shipped `dispose()`. Memory units,
  construction topology, drain protocol, and ceilings are unchanged.
- Native async and global-atom lanes are removed, never replaced. Hydration uses
  valid same-domain State and the shipped disposable adapter host.
- Returned/thrown thenables from both getter and comparator produced
  `InvalidSynchronousSelectorResultError`; containment ran once in each probe.

The admission script deliberately does not claim exhaustive enumeration, graph
record verification, timing qualification, or memory-ceiling passes. Those are
F2–F7 requirements and remain separate.
