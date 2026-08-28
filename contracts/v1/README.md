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
  public API and callback IDs. Manifest IDs must equal it in both directions.
- `frozen-legacy-surface.json` records the exact, unique beta.23 root runtime
  and type exports that a complete migration inventory must classify.
- `schemas/` documents the file formats.
- `check.ts` executes those JSON Schemas and enforces cross-file references,
  target/migration invariants, updater result policies, and the honesty of the
  declared completeness state. A complete manifest must equal the frozen legacy
  surface exactly; aggregate counts or duplicate padding cannot open the gate.
  `check.test.ts` proves malformed and falsely-complete manifests fail.

Run:

```sh
bun run check:contracts-v1
```

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

## Provenance

The checked-out workspace is commit `ff1424bde13445eba07fcb426f5493dd43898f72`
and its `valdres` package is `1.0.0-beta.22`. The frozen legacy reference is the
separately audited `1.0.0-beta.23` tarball with SHA-256
`d98638aa0d8890d35f25b2a132fb7add0355206f925fcf2a4cfe0104a20cafa4`. The manifest
records its immutable npm spec, registry tarball URL, and SHA-512 registry
integrity; the machine-local audit path is only a secondary trace.

No current ShiftX checkout exists in this workspace. `currentShiftX` therefore
remains `external-handoff-required`; the historical sparse 2024 snapshot can
inform migration hypotheses but cannot satisfy an evidence gate.
