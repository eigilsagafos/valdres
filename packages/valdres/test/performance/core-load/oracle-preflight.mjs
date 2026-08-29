import { oracleEvidenceId, publicWorkFrom, sha256File } from "./lib.mjs"

export function runAuthoritativeOraclePreflight({
    fixturePath,
    scenarios,
    targets,
    runFreshProcess,
    validateSample,
}) {
    const fixtureSha256 = sha256File(fixturePath)
    const evidence = {}
    let processOrder = 0
    for (const scenario of scenarios) {
        evidence[scenario] = {}
        for (const target of targets) {
            processOrder++
            const sample = runFreshProcess({
                mode: "oracle",
                fixturePath,
                scenario,
                target,
            })
            validateSample(sample, target, scenario)
            if (sample.mode !== "oracle" || sample.elapsedMs !== null) {
                throw new Error(
                    `${target.label} ${scenario}: oracle preflight emitted a timing sample`,
                )
            }
            const evidenceId = oracleEvidenceId({
                fixtureSha256,
                scenario,
                role: target.role,
                artifactSha256: target.artifact.tarballSha256,
                adapterSha256: target.provenance.adapterSha256,
                semanticChecksum: sample.semanticChecksum,
                oracleTraceSha256: sample.oracleTraceSha256,
            })
            evidence[scenario][target.role] = {
                evidenceId,
                processOrder,
                processId: sample.process.pid,
                label: target.label,
                adapter: target.adapter,
                artifactSha256: target.artifact.tarballSha256,
                adapterSha256: target.provenance.adapterSha256,
                semanticChecksum: sample.semanticChecksum,
                oracleTraceSha256: sample.oracleTraceSha256,
                selectedFinalValues: sample.selectedFinalValues,
                counterReset: sample.counterReset,
                publicWork: publicWorkFrom(sample),
                postDrain: sample.postDrain,
            }
        }
    }
    return {
        status: "passed",
        required: true,
        completedBeforeTiming: true,
        freshProcessPerTargetPerScenario: true,
        evidence,
    }
}
