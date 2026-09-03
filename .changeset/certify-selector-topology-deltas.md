---
"valdres": patch
---

Replace repeated selector-prefix cycle walks with bounded, exact topology-delta
proofs while preserving the existing ordered fallback for cycle attribution. The
`valdres.inspect` export is now schema version 2 and reports topology-delta
proofs through `bySite.topologyDeltaProof`, each host's
`byLane.*.topologyDeltaProof` bucket, and the `site: "topology-delta-proof"`
detail value.
