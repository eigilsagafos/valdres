import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { manifest, json, fileHash, requireGate } from "./inputs.mjs"
import { initializeRun, EVIDENCE_ROOT } from "./run.mjs"
import { packArtifact, smokeArtifact } from "./artifact.mjs"
import { validateArtifactEvidence } from "./artifact-validation.mjs"
import { runSemantics, runFrozenFamily } from "./semantics.mjs"
import { runCorePreflight } from "./core-preflight.mjs"
import { createPreflight } from "./preflight.mjs"
import { checkWorkloadCorpus } from "./workloads.mjs"
import { validateCounters } from "./counter-validation.mjs"
import {
    collectTimings,
    validateTimings,
    withRunnerLock,
} from "./timing-evidence.mjs"
import { collectMemory, collectSizes } from "./resources.mjs"
import { verifyProvenanceCurrent } from "./provenance.mjs"
import { writeEvidence, sealEvidence } from "./evidence.mjs"
import { finalizeReport } from "./report.mjs"

// The control has one fixed identity and no intended-win declaration. This
// command cannot initialize, qualify, or promote a candidate workspace.
export async function buildControlBundle({
    runId,
    evidenceRoot = EVIDENCE_ROOT,
} = {}) {
    const plan = {
        schemaVersion: 2,
        kind: "control",
        id: "beta36-control",
        revision: 1,
        stage: "A",
        gitSha: manifest.control.gitSha,
        intendedWorkloads: [],
        algorithmicConstants: [],
    }
    return withRunnerLock(evidenceRoot, async () => {
        const { root, index, provenance, planArtifact } = await initializeRun({
            plan,
            evidenceRoot,
            ...(runId ? { runId } : {}),
        })
        const progress = phase =>
            console.log(
                JSON.stringify({ root, phase, at: new Date().toISOString() }),
            )
        progress("initialized")
        try {
            const directories = {},
                artifacts = {}
            for (const mode of ["timed", "counter"]) {
                const path = index.artifacts.control[mode]
                directories[mode] = join(root, dirname(path))
                progress(`pack-${mode}`)
                await packArtifact({
                    commit: manifest.control.gitSha,
                    output: directories[mode],
                    mode,
                })
                artifacts[mode] = validateArtifactEvidence(root, path, {
                    gitSha: manifest.control.gitSha,
                    mode,
                })
                for (const runtime of ["bun", "node"])
                    smokeArtifact(directories[mode], runtime)
            }
            for (const [mode, artifactMode] of [
                ["public", "timed"],
                ["counter", "counter"],
            ]) {
                progress(`semantics-${mode}`)
                runSemantics({
                    artifactDirectory: directories[artifactMode],
                    output: join(root, `semantics-${mode}`),
                    stage: "A",
                })
            }
            progress("family-and-core-oracle")
            const family = runFrozenFamily(join(root, "family"))
            family.process = "family/" + family.process
            writeEvidence(root, "family/compatibility.json", family)
            const core = runCorePreflight(
                root,
                directories.timed,
                "core-oracle",
            )
            for (const stage of ["C", "A"]) {
                const preflight = createPreflight(root, {
                    stage,
                    ...artifacts,
                    publicEvidence: "semantics-public/semantics.json",
                    counterEvidence: "semantics-counter/semantics.json",
                    familyEvidence: "family/compatibility.json",
                    coreEvidence: core,
                })
                writeEvidence(root, index.preflights[stage].control, preflight)
            }
            progress("counter-workloads")
            const corpus = checkWorkloadCorpus(
                directories.counter,
                join(root, "counter-workloads"),
            )
            writeEvidence(root, "counter-workloads/runner.json", corpus.runner)
            const counters = {
                schemaVersion: 2,
                stage: "A",
                artifactSha256: artifacts.counter.tarballSha256,
                rows: corpus.rows.map(row => {
                    const evidence = `counter-workloads/${row.id}-${row.runtime}.process.json`
                    return {
                        id: row.id,
                        runtime: row.runtime,
                        common: row.common,
                        candidateNamespace: null,
                        candidateSpecific: row.candidateSpecific,
                        evidence,
                        sha256: fileHash(join(root, evidence)),
                    }
                }),
            }
            validateCounters(root, counters, {
                stage: "A",
                artifact: artifacts.counter,
                kind: "control",
                id: plan.id,
            })
            writeEvidence(root, "counters.json", counters)
            const records = [],
                decisions = {}
            for (const stage of ["C", "A"]) {
                progress(`timing-${stage}`)
                const samples = collectTimings({
                    root,
                    stage,
                    planArtifact,
                    provenance,
                    controlDirectory: directories.timed,
                    headDirectory: directories.timed,
                    preflightControl: index.preflights[stage].control,
                    preflightHead: index.preflights[stage].candidate,
                })
                records.push(...samples)
                decisions[stage] = validateTimings(root, samples, {
                    stage,
                    plan,
                    artifacts: {
                        control: artifacts.timed,
                        candidate: artifacts.timed,
                    },
                })
            }
            writeEvidence(
                root,
                "timings.ndjson",
                records.map(row => JSON.stringify(row) + "\n").join(""),
            )
            writeEvidence(root, "timing-decisions.json", decisions)
            progress("packed-size")
            const resourceInputs = {
                controlDirectory: directories.timed,
                headDirectory: directories.timed,
                provenance,
                index,
            }
            collectSizes(root, resourceInputs)
            progress("retained-memory")
            collectMemory(root, resourceInputs)
            verifyProvenanceCurrent(provenance)
            writeEvidence(root, "completion.json", {
                endedAt: new Date().toISOString(),
            })
            progress("recompute-and-seal")
            const result = await finalizeReport(root)
            progress(`sealed-${result.report.status}`)
            requireGate(
                result.report.status === "pass",
                "CONTROL-FOUNDATION-DEFECT",
                `recorded control gates fail; sealed bundle ${root}; SHA256SUMS ${result.sha256sums}`,
            )
            return {
                root,
                sha256sums: result.sha256sums,
                status: result.report.status,
            }
        } catch (error) {
            if (!existsSync(join(root, "SHA256SUMS"))) {
                writeEvidence(root, "invalid-run.json", {
                    kind: "invalid-run",
                    reason: error.message,
                    at: new Date().toISOString(),
                })
                const sha256sums = sealEvidence(root)
                console.error(
                    JSON.stringify({
                        root,
                        status: "invalid",
                        sha256sums,
                        reason: error.message,
                    }),
                )
            }
            throw error
        }
    })
}
if (import.meta.main) {
    try {
        const [action, runId] = process.argv.slice(2)
        requireGate(
            action === "run" && process.argv.length <= 4,
            "CONTROL-CLI",
            "usage: control-bundle.mjs run [NEW_RUN_ID]",
        )
        console.log(JSON.stringify(await buildControlBundle({ runId })))
    } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}
