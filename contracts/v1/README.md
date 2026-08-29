# Valdres v1 contract manifests

These files turn the Phase 0 recovery-plan decisions into queryable, reviewed
artifacts. They are not generated from the beta source because the v1 contract
deliberately removes behavior that the beta implements.

- `public-api.json` owns semantic migration dispositions. Each legacy surface
  carries its own immutable coordinate kind, independent of the target entry's
  semantic kind.
- `legacy-disposition-catalog.json` is the closed-world reviewed join from each
  frozen legacy coordinate to exactly one public disposition ID. Partial work
  may leave coordinates unmapped, but it may not attach them to an arbitrary
  existing row; completion requires exact bidirectional coverage and approval.
  The current reviewed mapping payload is independently digest-pinned in the
  checker, so editing the catalog and manifest together cannot self-authorize a
  different ownership map.
- `callback-capabilities.json` owns every function-valued public input and its
  capability/error boundary.
- `contract-catalog.json` is the reviewed namespace for every contract ID used
  by either manifest.
- `target-surface-catalog.json` is the independently reviewed set of intended
  public API and callback IDs plus the explicit independent-beta subset and
  frozen coordinates for every currently approved stable or experimental target.
  Manifest IDs must equal it in both directions, and frozen
  kind/package/subpath/name coordinates must match independently. The stable
  structural-query primitive is the standalone, zero-operator-import recursive
  object grammar proven by the D43.1 spike; its fluent builder remains reserved
  for experimental multi-collection search. The reviewed alias decisions keep
  narrowed `EqualFunc`, `FamilyKey`, `GetValue`, `SubscribeFn`, and generic
  `TransactionFn`, while removing `ResetAtom`, `SetAtom`, `SetAtomValue`, and
  `SyncSetAtom`; unresolved adapter-protocol, error-name, and option-spelling
  decisions remain listed explicitly without invented coordinates. A second
  reviewed digest pins each public entry's owner, kind, target status, migration
  mode, and replacements, together with callback-to-API ownership, the
  independent-beta subset, and every pending decision, so coordinated relabels
  or semantic rewrites cannot self-authorize.
- `frozen-legacy-surface.json` records immutable, provenance-stamped coordinates
  for the beta.23 core root and adapter exports, the actual beta.4 React
  exports, Store/Transaction/adapter members and overloads, and public
  options/props. Pinned Git trees and blobs plus an independent coordinate
  digest prevent the inventory from self-attesting after an edit.
- `generate-public-api-skeletons.ts` deterministically emits one evidence-free
  `pending-review` JSONL skeleton for every frozen coordinate not yet owned by
  the disposition catalog. It never invents contract coverage or a target.
- `frozen-test-inventory.json` freezes every beta.23 production TypeScript file,
  every zero-registration type-test file, and every Bun-registered test case
  with source-blob and, for registered cases, source-line evidence.
- `generate-frozen-test-inventory.ts` reproduces that inventory from immutable
  source/release commits, the source revision's frozen lockfile, the published
  tarball, and an isolated Bun run.
- `test-dispositions.jsonl` is the scalable Phase 1 A/B/C/D/E ledger. Its first
  line is the header; later lines are dispositions or stable reference-model
  test owners. JSONL keeps future generated updates and reviews line-oriented.
- `generate-test-dispositions.ts` deterministically proposes one disposition for
  every test subject in the frozen inventory. It preserves the four existing
  semantic review handles and their explicit evidence without assigning evidence
  to any newly generated row.
- `production-source-dispositions.jsonl` separately classifies the 190 frozen
  production-file subjects by implementation action and review ownership; it
  does not place production source into the test A/B/C/D/E taxonomy.
- `generate-production-source-dispositions.ts` validates that separate ledger
  and its exact join to the frozen inventory.
- `schemas/` documents the file formats.
- `check.ts` executes those JSON Schemas and enforces cross-file references,
  target/migration invariants, updater result policies, and the honesty of the
  declared completeness state. A complete manifest must equal the frozen legacy
  surface and reviewed ownership map exactly; aggregate counts, duplicate
  padding, or attaching all exports to one disposition cannot open the gate.
  Current ShiftX completion additionally requires stamped external repository,
  lockfile, packed-artifact, checked-path, passing-verdict, and audit-report
  evidence whose exact payload has been independently reviewed and digest-pinned
  in the checker; no ShiftX payload is pinned on this laptop, so an inline or
  fabricated payload cannot open completion. Once a payload is pinned, the
  checker also verifies the portable report artifact's exact bytes. The external
  verifier—not ordinary Valdres CI—checks the private checkout's origin, branch,
  HEAD, clean status, checked paths, and exact lockfile/candidate bytes before
  emitting that report. It also parses and validates the disposition ledger,
  including contract and test-owner joins. `check.test.ts` proves malformed and
  falsely-complete manifests and ledgers fail.

Run:

```sh
bun run check:contracts-v1

# Audit for any unowned migration coordinate (currently expected to print nothing)
bun contracts/v1/generate-public-api-skeletons.ts
```

That command type-checks the contracts, regenerates the frozen inventory in
check mode from the pinned beta.23 provenance, validates the separate production
ledger, validates every manifest, executes each implemented owner file with Bun
and verifies the exact owner test was collected and passed, then runs both
ledger regression suites. CI runs this same command; `bun run verify` reads it
directly from the CI workflow.

The manifests and both reviewed catalogs currently declare themselves `partial`.
That is intentional. All 174 frozen legacy coordinates now have exact approved
disposition ownership, the 156 formerly unowned coordinates resolve as 35
`keep`, 35 `replace`, 63 `remove`, and 23 `move` decisions, and the skeleton
generator therefore emits no rows. Completion still waits on the unresolved
adapter-protocol, additional error-name, and option-spelling coordinates; the
remaining target/package contracts; stable callback and contract-catalog gates;
and stamped current ShiftX evidence. All four completeness flags still change
together. Independent beta entries may remain evidence-gated; they do not open
or block the stable-1.0 completeness gate.

`FamilyKey` now means exactly
`string | number | bigint | boolean | symbol | null | undefined`; it no longer
accepts Date, Array, object, Map, or Set values. Structured family inputs
require an explicit `encodeKey`. `EqualFunc<Value>` is exactly a two-argument
previous/next comparator. `GetValue` and `SubscribeFn` remain the public
synchronous Store method-capability types, and `TransactionFn<Result = unknown>`
preserves the transaction callback result. The four removed mutation aliases are
intentionally replaced by the canonical Store/Transaction method types and the
exact-value-versus-updater split.

Exact manifest/catalog parity does not prove that the target catalog is
exhaustive. Before changing `target-surface-catalog.json` to `complete`, Phase 0
must independently review and freeze its API and callback ID sets against the
recovery plan and every approved stable/beta decision. Copying IDs out of the
manifests is not sufficient evidence.

## Stable standalone collection-operation spelling

The stable operation boundary now freezes these standalone imports:

```text
valdres/collection
  materialize(store, index, options?)
  scan(storeOrTxn, query)
  getMaterializationStatus(materialization)
  subscribeMaterialization(materialization, listener)

valdres/collection/artifacts
  exportArtifact(materialization)
  importArtifact(store, index, artifact)
```

`materialize` and `importArtifact` return the same opaque materialization-handle
abstraction. Status observation consumes that handle, and progress is contained
inside the opaque status snapshot returned by `getMaterializationStatus` and
delivered to `subscribeMaterialization`. There are no equivalent Store or
Transaction methods and no separate progress function. `scan` is the explicit
exact path and accepts either a Store or an active Transaction plus an opaque
structural query.

“Contained inside status” does not yet freeze a `.progress` property or any
other status-field name or shape; that vocabulary remains a production API
decision.

This is a spelling and ownership freeze, not a production implementation or a
freeze of every signature detail. `collection-operations.type-test.ts` proves
only those call relationships. Query construction is now frozen separately as
the root `query(collection, recursiveObjectDefinition)` form. Materialization
option members, scheduler and priority policy, public retry/cancel controls,
status field vocabulary, artifact representation/codec/schema/security,
persistence, and artifact execution timing remain unresolved. The executable
collection-operations and query-construction spikes remain semantic evidence;
they are not exported runtime code.

## Phase 1 test-disposition ledger

Each `disposition` record identifies exactly one subject by origin, path, kind,
and, for a test case, its full test name. IDs are stable review handles rather
than hashes of mutable prose. The dispositions are:

- `A`: retain a black-box assertion of a stable 1.0 contract;
- `B`: rewrite a valuable public outcome that is coupled to private structure;
- `C`: move the behavior to its named companion or compatibility destination;
- `D`: delete behavior that 1.0 intentionally does not support;
- `E`: migrate infrastructure, build, type, fuzz, benchmark, documentation, or
  release coverage to the new artifact.

Rows begin as `proposed` and become `approved` only after review. Approved `A`
and `B` rows must name at least one catalogued contract and at least one
registered `test-owner`; the referenced owners must collectively cover every
contract on the disposition. Approved `C` rows must name their destination.
Duplicate IDs, duplicate source subjects, dangling owners, and uncatalogued
contracts fail validation.

The current first pass classifies all 1,640 beta.23 test subjects—1,636
Bun-registered cases plus four zero-registration type-test files—as 24 `A`, 283
`B`, 370 `C`, 726 `D`, and 237 `E`. Every row remains `proposed`; this is a
review candidate, not approval. Newly proposed rows have empty `contractIds` and
`ownerIds`, so classification does not fabricate replacement coverage. The four
pre-existing semantic rows retain only their previously recorded explicit owner
and contract evidence.

The four type-file rows are proposed `E` migrations. Their destinations include
an explicit `(planned)` suffix and their rationales describe the replacement
compile-time gate; neither the inventory nor the ledger claims those destination
files already exist.

The focused review resolved all 57 structured `needsReview` markers into final
proposed classifications: 13 `B`, three `C`, and 41 `D`. No test row now carries
a human-judgment marker. Every row still requires normal review; resolving a
marker is not approval and does not invent contract, owner, or replacement-test
evidence.

Reference-model owner IDs use the stable `V1M-<DOMAIN>-<NNN>` form and must be
embedded in the implemented Bun test name. A planned owner records its intended
path with `testName: null`; implementation changes that to the exact test name
and `status: "implemented"`. This makes the join additive without inventing a
test title or claiming that planned code already exists. The checker safely
loads each implemented owner's repository-relative source file and verifies its
exact literal `describe > test` name and requires that exact canonical name,
with at least one assertion, in the successful Bun JUnit output. A nonexistent
path, dead branch, shadowed test function, skipped or empty test, failing file,
or invented title therefore cannot self-attest as executable evidence. The
initial Atom, scope, transaction, subscription, collection, and selector owner
IDs now point to passing model/evaluator tests. Selector behavior is also
checked against a separate symbolic oracle; no legacy subject is silently
classified on any owner's behalf.

The test ledger intentionally remains `partial` because all classifications are
still proposed. Its frozen header contains exactly 1,640 expected test-subject
IDs and declares complete classification scopes for both the 1,636 registered
test cases and four zero-registration test files. The checker requires exact
bidirectional ID-and-subject parity for that union and reports zero unclassified
test subjects. The 190 production-file subjects are reserved for the separate
production-source ledger and are reported as that artifact's subjects, not as
missing rows in the test ledger. Test-ledger `complete` means every scoped test
row is approved, every referenced owner is implemented, and the scoped remainder
is zero; it does not absorb production-source classification.

The checker resolves the inventory without following a symlink outside the
repository, validates its schema, verifies its exact bytes against the header
SHA-256, and derives its 190 production-file, four test-file, 1,636 test-case,
and 1,830 total counts. The generator independently enumerates the production
and test files from Git and captures 1,636 runtime-expanded names from all 141
`*.test.ts` files. Four type-test files execute at module load but register no
Bun test cases; each now has a stable `test-file` inventory ID, source-blob
evidence, and an explicit proposed disposition.

Regenerate the proposed test-subject ledger from the frozen inventory:

```sh
bun contracts/v1/generate-test-dispositions.ts --write
```

Use `--check` to require byte-for-byte agreement with the checked-in ledger; the
standard contract/CI gate runs that mode. Without `--write` or `--check`, the
generator emits the candidate JSONL to stdout. Every mode asserts the exact
category totals and zero unresolved human-review markers before returning.

Validate the separate production-source ledger and its frozen-inventory join:

```sh
bun contracts/v1/generate-production-source-dispositions.ts
```

`--check-seed` additionally proves the current all-proposed ledger is byte-for-
byte equal to its deterministic initial classification. It is a seed audit, not
a rule that future reviewed/approved rows must remain unchanged.

Reproduce the audit from the checked-out Git objects and published tarball (the
isolated test run takes roughly half a minute):

```sh
bun contracts/v1/generate-frozen-test-inventory.ts --check
```

The generator archives the pinned source revision into a temporary directory,
verifies its `bun.lock` Git blob and SHA-256, installs that lockfile with Bun
1.4.0 using `--frozen-lockfile --ignore-scripts`, and runs the beta suite
without linking the current workspace's `node_modules`. It uses the ignored
local audit tarball when present; a clean clone fetches the exact immutable
registry URL into the temporary directory, then applies the same pinned
SHA/name/version checks. CI checks out full Git history because both pinned
commit objects are required.

The isolated runs observed 328,426–328,427 JUnit assertions because a legacy
fuzz/property loop has a volatile aggregate count. That non-identity metric is
not serialized into the inventory SHA. Regeneration instead requires at least
328,000 assertions, along with exactly 1,636 registered subjects and zero
failures or skips, so a materially incomplete run still fails without making the
frozen artifact nondeterministic.

An intentional re-audit uses `--write`; this rewrites only the inventory and its
frozen header evidence while preserving ledger rows and completeness.
`--junit <path>` can reuse a prior isolated beta.23 JUnit capture. Current
Current ShiftX and index-operational evidence remain separate Phase 0 gates and
are not implied by this ledger.

## Provenance

The workspace source baseline recorded by the manifest is commit
`ff1424bde13445eba07fcb426f5493dd43898f72`, whose `valdres` package is
`1.0.0-beta.22`. The frozen legacy reference is the separately audited
`1.0.0-beta.23` tarball with SHA-256
`d98638aa0d8890d35f25b2a132fb7add0355206f925fcf2a4cfe0104a20cafa4`. The manifest
records its immutable npm spec, registry tarball URL, and SHA-512 registry
integrity; the machine-local audit path is only a secondary trace.

The test inventory uses source commit `c071cdaba26a2f30243d43516a199a94a9137c6e`
and release commit `6adb53a240a84fc90b8ad8dc2af77611e45dfd08`. Their Valdres
source and test trees are byte-identical
(`2e521d12d483d1d59030f95cacac6a1f2801232d` and
`785381e6d0bf303ad8d67dd3ba2af1f58be2a121`), tying the unpublished tests to the
exact source represented by the published beta.23 package. The source lockfile
is independently pinned as Git blob `8684a8d328c8e0bfdeb9c7f6ccb849d9cd9ecc05`
and SHA-256 `c79a4fe44e6caa93c294744ba6ded67ccf2844286d5218e509cfa944f8b6a2d0`.

No current ShiftX checkout exists in this workspace. `currentShiftX` therefore
remains `external-handoff-required`; the historical sparse 2024 snapshot can
inform migration hypotheses but cannot satisfy an evidence gate.
