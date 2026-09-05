import { mkdirSync } from "node:fs"
import { join, isAbsolute } from "node:path"
import {
    ROOT,
    git,
    json,
    fileHash,
    assertClean,
    checkInputs,
    requireGate,
} from "./inputs.mjs"
import { writeEvidence, verifySeal, sealEvidence } from "./evidence.mjs"
import { captureCommand } from "./artifact.mjs"
import { validateProcess } from "./process-evidence.mjs"
import { RED_CASES } from "./red-cases.mjs"
import { validateRedBundle, validateRedProcesses } from "./red-validation.mjs"
export async function buildRedBundle(
    controlRoot,
    root,
    { development = false } = {},
) {
    assertClean()
    checkInputs()
    requireGate(
        isAbsolute(controlRoot) && isAbsolute(root),
        "RED-PATH",
        "absolute shared roots required",
    )
    verifySeal(controlRoot)
    const foundationSha = git(["rev-parse", "HEAD"])
    if (!development) {
        const { validateReportBundle } = await import("./report.mjs")
        const report = await validateReportBundle(
            controlRoot,
            fileHash(join(controlRoot, "SHA256SUMS")),
        )
        requireGate(
            report.kind === "foundation-control" &&
                report.status === "pass" &&
                report.foundation.gitSha === foundationSha,
            "RED-GREEN",
            "same frozen SHA green control required",
        )
    }
    mkdirSync(root)
    try {
        const control = {
            path: controlRoot,
            sha256sums: fileHash(join(controlRoot, "SHA256SUMS")),
        }
        const proof = {
            schemaVersion: 3,
            kind: development ? "diagnostic-red-probe" : "red-gate-proofs",
            foundationSha,
            control,
            rows: [],
        }
        const worker = join(root, "red-worker.mjs")
        const build = captureCommand(
            [
                "bun",
                "build",
                join(ROOT, "scripts/selector-kernel-tournament/red-worker.mjs"),
                "--target=node",
                `--outfile=${worker}`,
            ],
            ROOT,
        )
        writeEvidence(root, "worker-build.process.json", build)
        validateProcess(build)
        for (const row of RED_CASES) {
            const result = { ...row }
            for (const mode of ["baseline", "mutation"]) {
                console.log(
                    JSON.stringify({
                        root,
                        phase: row.variant + "/" + mode,
                        at: new Date().toISOString(),
                    }),
                )
                const output = join(root, row.variant + "-" + mode)
                const process = captureCommand(
                    [
                        "bun",
                        worker,
                        ROOT,
                        row.id,
                        row.variant,
                        controlRoot,
                        mode,
                        output,
                    ],
                    ROOT,
                    { timeout: 600000 },
                )
                const path = row.variant + "-" + mode + ".process.json"
                const ref = writeEvidence(root, path, process)
                result[mode] = { process: path, sha256: ref.sha256 }
                validateProcess(process, { success: mode === "baseline" })
                requireGate(
                    mode === "baseline" ||
                        (process.status === 1 &&
                            process.signal === null &&
                            process.error === null &&
                            process.stderr.includes(row.expectedGate + ":")),
                    "RED-WRONG-FAILURE",
                    `${row.variant}: ${process.stderr}`,
                )
            }
            proof.rows.push(result)
        }
        validateRedProcesses(root, proof)
        writeEvidence(root, "red.json", proof)
        const sha256sums = sealEvidence(root)
        if (!development)
            await validateRedBundle(root, sha256sums, {
                green: control,
                foundationSha,
            })
        return {
            root,
            sha256sums,
            classes: new Set(RED_CASES.map(r => r.id)).size,
            variants: proof.rows.length,
            processes: proof.rows.length * 2,
            kind: proof.kind,
        }
    } catch (error) {
        writeEvidence(root, "invalid-run.json", {
            schemaVersion: 3,
            reason: error.message,
        })
        console.error(
            JSON.stringify({
                root,
                sha256sums: sealEvidence(root),
                reason: error.message,
            }),
        )
        throw error
    }
}
if (import.meta.main) {
    try {
        const [action, controlRoot, root] = process.argv.slice(2)
        requireGate(
            ["run", "probe"].includes(action) &&
                root &&
                process.argv.length === 5,
            "RED-CLI",
            "red-bundle.mjs run|probe CONTROL_ROOT NEW_OUTPUT_ROOT",
        )
        console.log(
            JSON.stringify(
                await buildRedBundle(controlRoot, root, {
                    development: action === "probe",
                }),
            ),
        )
    } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}
