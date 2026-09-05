import { join } from "node:path"
import { ROOT, json, fileHash, requireGate, exactRows } from "./inputs.mjs"
import { verifySeal, evidencePath, strictKeys, same } from "./evidence.mjs"
import { validateProcess } from "./process-evidence.mjs"
import { verifyCompiledWorker } from "./runner-validation.mjs"
import { RED_CASES } from "./red-cases.mjs"
import { recordedRoot } from "./recorded-root.mjs"
export const RED_GATES = Object.fromEntries(
    RED_CASES.map(r => [r.id, r.expectedGate]),
)
export function validateRedProcesses(
    root,
    proof,
    authorityRoot = recordedRoot(),
) {
    same(
        proof.authorityRoot,
        authorityRoot,
        "RED-AUTHORITY",
        "red launcher must use the authenticated recorded authority",
    )
    exactRows(
        proof.rows.map(r => r.id + "/" + r.variant),
        RED_CASES.map(r => r.id + "/" + r.variant),
        "RED-INVENTORY",
    )
    const worker = join(root, "red-worker.mjs")
    verifyCompiledWorker(
        worker,
        "scripts/selector-kernel-tournament/red-worker.mjs",
    )
    requireGate(
        typeof proof.authorityRoot === "string" &&
            proof.authorityRoot.startsWith("/"),
        "RED-IDENTITY",
        "recorded authority root required",
    )
    const used = new Set()
    for (const row of proof.rows) {
        strictKeys(
            row,
            ["id", "variant", "expectedGate", "baseline", "mutation"],
            "RED-SCHEMA",
        )
        const wanted = RED_CASES.find(
            r => r.id === row.id && r.variant === row.variant,
        )
        requireGate(
            row.expectedGate === wanted.expectedGate,
            "RED-EXPECTED-GATE",
            "wrong gate class",
        )
        for (const mode of ["baseline", "mutation"]) {
            const ref = row[mode]
            strictKeys(ref, ["process", "sha256"], "RED-SCHEMA")
            requireGate(!used.has(ref.process), "RED-PROCESS", "reused process")
            used.add(ref.process)
            requireGate(
                fileHash(evidencePath(root, ref.process)) === ref.sha256,
                "RED-PROCESS-HASH",
                row.id,
            )
            const process = json(evidencePath(root, ref.process))
            const directory = join(root, row.variant + "-" + mode)
            validateProcess(process, {
                cwd: authorityRoot,
                argv: [
                    "bun",
                    worker,
                    proof.authorityRoot,
                    row.id,
                    row.variant,
                    proof.control.path,
                    mode,
                    directory,
                ],
                success: mode === "baseline",
            })
            const input = json(join(directory, "input.json"))
            same(
                input,
                {
                    schemaVersion: 3,
                    foundationSha: proof.foundationSha,
                    id: row.id,
                    variant: row.variant,
                    mode,
                    controlRoot: proof.control.path,
                    expectedGate: row.expectedGate,
                },
                "RED-IDENTITY",
                "mutation inputs differ",
            )
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
export async function validateRedBundle(
    root,
    expectedSums,
    { green, foundationSha, authorityRoot = recordedRoot() },
) {
    verifySeal(root, expectedSums)
    const proof = json(evidencePath(root, "red.json"))
    strictKeys(
        proof,
        [
            "schemaVersion",
            "kind",
            "foundationSha",
            "authorityRoot",
            "control",
            "rows",
        ],
        "RED-SCHEMA",
    )
    requireGate(
        proof.schemaVersion === 3 &&
            proof.kind === "red-gate-proofs" &&
            proof.foundationSha === foundationSha,
        "RED-IDENTITY",
        "wrong foundation or diagnostic format",
    )
    same(proof.control, green, "RED-IDENTITY", "wrong green control")
    verifySeal(green.path, green.sha256sums)
    return validateRedProcesses(root, proof, authorityRoot)
}
