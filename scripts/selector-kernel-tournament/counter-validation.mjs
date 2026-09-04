import { join } from "node:path"
import { manifest, json, requireGate, exactRows, fileHash } from "./inputs.mjs"
import { evidencePath, same, strictKeys } from "./evidence.mjs"
import { validateWorkloadInvocation } from "./runner-validation.mjs"
import { validateWorkloadSample } from "./workload-validation.mjs"
import { EXPECTATIONS } from "./workloads.mjs"
export function validateCounters(
    root,
    counters,
    { stage, artifact, kind, id },
) {
    strictKeys(
        counters,
        ["schemaVersion", "stage", "artifactSha256", "rows"],
        "COUNTER-SCHEMA",
    )
    requireGate(
        counters.schemaVersion === 2 &&
            counters.stage === stage &&
            counters.artifactSha256 === artifact.tarballSha256 &&
            artifact.mode === "counter",
        "COUNTER-IDENTITY",
        "counter artifact differs",
    )
    const expected = manifest.performanceWorkloads
        .filter(r => r.requiredAt.includes(stage))
        .flatMap(row => row.runtimes.map(runtime => row.id + "/" + runtime))
    exactRows(
        counters.rows.map(r => r.id + "/" + r.runtime),
        expected,
        "COUNTER-INVENTORY",
    )
    for (const row of counters.rows) {
        strictKeys(
            row,
            [
                "id",
                "runtime",
                "common",
                "candidateNamespace",
                "candidateSpecific",
                "evidence",
                "sha256",
            ],
            "COUNTER-SCHEMA",
        )
        requireGate(
            fileHash(evidencePath(root, row.evidence)) === row.sha256,
            "COUNTER-HASH",
            row.id,
        )
        const process = json(evidencePath(root, row.evidence))
        validateWorkloadInvocation(root, process, {
            stage: "counter",
            id: row.id,
            runtime: row.runtime,
            mode: "counter",
            artifact,
        })
        const sample = JSON.parse(process.stdout)
        requireGate(
            sample.pid === process.pid,
            "PROVENANCE-PID",
            "counter process identity",
        )
        validateWorkloadSample(sample, {
            row: manifest.performanceWorkloads.find(r => r.id === row.id),
            runtime: row.runtime,
            mode: "counter",
            expected: json(EXPECTATIONS).rows.find(r => r.id === row.id),
            entrySha256: artifact.productionEntrySha256,
        })
        same(
            row.common,
            sample.common,
            "COUNTER-RESULT",
            "counter summary differs",
        )
        same(
            row.candidateSpecific,
            sample.candidateSpecific,
            "COUNTER-RESULT",
            "candidate counters differ from process",
        )
        const namespace =
            kind === "control"
                ? null
                : {
                      "incumbent-lite": "incumbent",
                      "reactive-currentness": "reactive",
                      "dynamic-topological": "dynamicTopo",
                  }[id]
        requireGate(
            row.candidateNamespace === namespace,
            "COUNTER-NAMESPACE",
            "wrong owner",
        )
        requireGate(
            row.candidateSpecific &&
                typeof row.candidateSpecific === "object" &&
                !Array.isArray(row.candidateSpecific) &&
                Object.entries(row.candidateSpecific).every(
                    ([key, value]) =>
                        key !== "visits" &&
                        Number.isSafeInteger(value) &&
                        value >= 0,
                ),
            "COUNTER-NAMESPACE",
            "invalid candidate-specific counters",
        )
        if (kind === "control")
            same(
                row.candidateSpecific,
                {},
                "COUNTER-NAMESPACE",
                "control has no candidate counters",
            )
    }
    return counters.rows.map(({ sha256, ...row }) => row)
}
