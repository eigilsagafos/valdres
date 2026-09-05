import { join } from "node:path"
import { writeFileSync } from "node:fs"
import { manifest, json, requireGate, git } from "./inputs.mjs"
import { installArtifact, inspectArtifact } from "./artifact.mjs"
import { prepareWorkloads, runWorkloadProcess } from "./workloads.mjs"
import { decideTournament } from "../lib/paired-decision-tournament.ts"
export function runCalibration(artifactDirectory, output) {
    const runner = prepareWorkloads(output),
        artifact = json(join(artifactDirectory, "artifact.json")),
        tarball = join(artifactDirectory, artifact.tarball)
    inspectArtifact(tarball, artifact, "timed").cleanup()
    const workload = manifest.performanceWorkloads.find(
            row => row.id === "P-FANOUT-128",
        ),
        rows = []
    for (const runtime of ["bun", "node"]) {
        const consumer = join(output, `consumer-${runtime}`)
        installArtifact(tarball, artifact, consumer)
        const samples = [],
            order = []
        for (let pair = 0; pair < 24; pair++) {
            const arms =
                pair % 2 ? ["replicate", "control"] : ["control", "replicate"]
            const values = {}
            for (const arm of arms) {
                const file = `${runtime}-${pair}-${arm}.process.json`
                values[arm] = runWorkloadProcess({
                    runner,
                    consumer,
                    artifact,
                    row: workload,
                    runtime,
                    mode: "timed",
                    output: join(output, file),
                })
                order.push({ pair, arm, file })
            }
            samples.push({
                pairId: String(pair),
                baseNs: values.control.durationNs,
                headNs: values.replicate.durationNs,
            })
        }
        const lane = {
            id: workload.id,
            runtime,
            core: false,
            intended: false,
            samples,
        }
        const aa = decideTournament([lane], "A", { control: true })
        const hypothetical = decideTournament(
            [{ ...lane, intended: true }],
            "A",
        )
        requireGate(
            hypothetical.intendedWinEstablished === false,
            "STATS-AA-FALSE-WIN",
            "live same-artifact calibration manufactured a win",
        )
        rows.push({
            runtime,
            order,
            samples,
            aa,
            hypotheticalIntendedWin: {
                kind: "calibration-only-no-candidate",
                established: hypothetical.intendedWinEstablished,
            },
        })
    }
    const result = {
        schemaVersion: 3,
        kind: "same-artifact-statistics-calibration",
        foundationGitSha: git(["rev-parse", "HEAD"]),
        artifact,
        rows,
    }
    writeFileSync(
        join(output, "calibration.json"),
        JSON.stringify(result, null, 2) + "\n",
    )
    return result
}
if (import.meta.main) {
    requireGate(
        process.argv.length === 4,
        "CALIBRATION-CLI",
        "usage: calibration.mjs TIMED_ARTIFACT NEW_OUTPUT",
    )
    console.log(JSON.stringify(runCalibration(...process.argv.slice(2))))
}
