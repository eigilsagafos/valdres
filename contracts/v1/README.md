# Valdres v1 contract manifests

These files turn the Phase 0 recovery-plan decisions into queryable, reviewed
artifacts. They are not generated from the beta source because the v1 contract
deliberately removes behavior that the beta implements.

- `public-api.json` owns public-surface classification and migration.
- `callback-capabilities.json` owns every function-valued public input and its
  capability/error boundary.
- `contract-catalog.json` is the reviewed namespace for every contract ID used
  by either manifest.
- `target-surface-catalog.json` is the independently reviewed set of intended
  public API and callback IDs plus the explicit independent-beta subset and
  frozen coordinates for stabilized standalone exports. Manifest IDs must equal
  it in both directions, and frozen package/subpath/name coordinates must match
  independently. An entry cannot opt out of the stable completion gate by
  renaming itself or changing its owner.
- `frozen-legacy-surface.json` records the exact, unique beta.23 root and
  `adapter-internals/v1` runtime/type exports that a complete migration
  inventory must classify.
- `frozen-test-inventory.json` freezes every beta.23 production TypeScript file
  and every Bun-registered test case with source-blob and source-line evidence.
- `generate-frozen-test-inventory.ts` reproduces that inventory from immutable
  source/release commits, the published tarball, and an isolated Bun run.
- `test-dispositions.jsonl` is the scalable Phase 1 A/B/C/D/E ledger. Its first
  line is the header; later lines are dispositions or stable reference-model
  test owners. JSONL keeps future generated updates and reviews line-oriented.
- `schemas/` documents the file formats.
- `check.ts` executes those JSON Schemas and enforces cross-file references,
  target/migration invariants, updater result policies, and the honesty of the
  declared completeness state. A complete manifest must equal the frozen legacy
  surface exactly; aggregate counts or duplicate padding cannot open the gate.
  It also parses and validates the disposition ledger, including contract and
  test-owner joins. `check.test.ts` proves malformed and falsely-complete
  manifests and ledgers fail.

Run:

```sh
bun run check:contracts-v1
```

That command type-checks the checker, validates every artifact, executes each
implemented owner file with Bun and verifies the exact owner test was collected
and passed, then runs the checker regression suite. CI runs this same command;
`bun run verify` reads it directly from the CI workflow.

The manifests and both reviewed catalogs currently declare themselves `partial`.
That is intentional: Phase 0 cannot exit until the full beta.23 surface,
Store/Transaction methods, React surface, adapter internals, stable subpaths,
errors, and stable callback inputs are present and all four completeness flags
change together. Independent beta entries may remain evidence-gated; they do not
open or block the stable-1.0 completeness gate.

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
only those call relationships. Query-construction grammar, materialization
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

The ledger intentionally remains `partial`. Its frozen header contains all 1,826
expected IDs, while only reviewed A/B/C/D/E rows appear in the ledger. For a
partial ledger the checker requires every classified row to be an exact
ID-and-subject subset of the frozen inventory and reports the exact remainder.
For a complete ledger it upgrades that condition to bidirectional parity,
requires every row to be approved, and requires the remainder to be zero. This
keeps the current 1,822-subject classification backlog explicit without
inventing dispositions.

The checker resolves the inventory without following a symlink outside the
repository, validates its schema, verifies its exact bytes against the header
SHA-256, and derives its production/test/total counts. The generator
independently enumerates 190 non-test `packages/valdres/src/**/*.ts` production
files from Git and captures 1,636 runtime-expanded names from all 141
`*.test.ts` files. Four type-test files execute at module load but register no
Bun test cases; the frozen provenance names them explicitly.

Reproduce the audit from the checked-out Git objects and local archived tarball
(the isolated test run takes roughly half a minute):

```sh
bun contracts/v1/generate-frozen-test-inventory.ts --check
```

An intentional re-audit uses `--write`; this rewrites only the inventory and its
frozen header evidence while preserving ledger rows and completeness.
`--junit <path>` can reuse a prior isolated beta.23 JUnit capture. Current
ShiftX, query-grammar, and index evidence remain separate Phase 0 gates and are
not implied by this ledger.

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
exact source represented by the published beta.23 package.

No current ShiftX checkout exists in this workspace. `currentShiftX` therefore
remains `external-handoff-required`; the historical sparse 2024 snapshot can
inform migration hypotheses but cannot satisfy an evidence gate.
