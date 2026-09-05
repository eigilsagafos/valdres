import { join } from "node:path"
import { json, fileHash, requireGate, exactRows } from "./inputs.mjs"
import { verifySeal, evidencePath, strictKeys, same } from "./evidence.mjs"
import { validateProcess } from "./process-evidence.mjs"
import { verifyCompiledWorker } from "./runner-validation.mjs"
export const RED_GATES = {
    "false-negative-cycle": "C-GRAPH-001",
    "false-positive-cycle": "C-GRAPH-001",
    "offending-edge-installation": "A-GRAPH-001",
    "wrong-causal-blame": "A-GRAPH-001",
    "non-sticky-caught-fault": "C-CYCLE-005",
    "notification-reorder-duplication": "A-SUB-001",
    "scratch-hydration-publication-leak": "C-TXN-001",
    "family-quarantine-bypass": "A-FAMILY-002",
    "frozen-family-path": "PROVENANCE-PROTECTED-PATH",
    "timed-instrumentation": "ARTIFACT-INSTRUMENTATION",
    "provenance-mismatch": "PROVENANCE-RESULT-ROW",
    "deterministic-20-percent-slowdown": "PERFORMANCE-REGRESSION",
    "retained-memory-leak": "MEMORY-ABSOLUTE",
    "root-bundle-leakage": "ARTIFACT-SOURCE-IMPORT",
}
export async function validateRedBundle(
    root,
    expectedSums,
    { green, foundationSha },
) {
    verifySeal(root, expectedSums)
    const proof = json(evidencePath(root, "red.json"))
    strictKeys(
        proof,
        ["schemaVersion", "kind", "foundationSha", "green", "rows"],
        "RED-SCHEMA",
    )
    requireGate(
        proof.schemaVersion === 3 &&
            proof.kind === "red-gate-proofs" &&
            proof.foundationSha === foundationSha,
        "RED-IDENTITY",
        "wrong foundation",
    )
    same(proof.green, green, "RED-IDENTITY", "wrong green control")
    exactRows(
        proof.rows.map(r => r.id),
        Object.keys(RED_GATES),
        "RED-INVENTORY",
    )
    const worker = join(root, "red-worker.mjs")
    verifyCompiledWorker(
        worker,
        "scripts/selector-kernel-tournament/red-worker.mjs",
    )
    for (const row of proof.rows) {
        strictKeys(
            row,
            ["id", "expectedGate", "baseline", "mutation"],
            "RED-SCHEMA",
        )
        requireGate(
            row.expectedGate === RED_GATES[row.id],
            "RED-EXPECTED-GATE",
            "wrong gate class",
        )
        for (const mode of ["baseline", "mutation"]) {
            const ref = row[mode]
            strictKeys(ref, ["process", "sha256"], "RED-SCHEMA")
            requireGate(
                fileHash(evidencePath(root, ref.process)) === ref.sha256,
                "RED-PROCESS-HASH",
                row.id,
            )
            const process = json(evidencePath(root, ref.process))
            validateProcess(process, {
                argv: ["bun", worker, row.id, green.path, mode],
                success: mode === "baseline",
            })
            if (mode === "mutation")
                requireGate(
                    process.status === 1 &&
                        process.error === null &&
                        process.signal === null &&
                        process.stderr.includes(row.expectedGate + ":"),
                    "RED-WRONG-FAILURE",
                    row.id,
                )
        }
    }
    return proof
}
