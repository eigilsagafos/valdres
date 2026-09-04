import { join } from "node:path"
import { json, requireGate } from "./inputs.mjs"
import { evidencePath, strictKeys, verifySeal } from "./evidence.mjs"
export async function validatePriorStage(root, plan) {
    if (plan.kind === "control" || plan.stage === "C") return null
    const prior = json(evidencePath(root, "prior-stage.json"))
    strictKeys(prior, ["path", "sha256sums"], "STAGE-PREREQUISITE")
    requireGate(
        prior.path.startsWith("/") && prior.path !== root,
        "STAGE-PREREQUISITE",
        "prior run must be a distinct immutable bundle",
    )
    verifySeal(prior.path, prior.sha256sums)
    const report = json(join(prior.path, "report.json")),
        expected = { A: "C", shiftx: "A", integration: "shiftx" }[plan.stage]
    requireGate(
        report.candidate?.stage === expected &&
            report.candidate.id === plan.id &&
            report.candidate.revision === plan.revision &&
            report.provenance.candidateIdentity.gitSha === plan.gitSha,
        "STAGE-PREREQUISITE",
        "preceding stage must qualify this exact revision",
    )
    const { validateReportBundle } = await import("./report.mjs")
    const verified = await validateReportBundle(prior.path, prior.sha256sums)
    requireGate(
        verified.selection.machineEligible,
        "STAGE-PREREQUISITE",
        "preceding stage did not qualify",
    )
    return prior
}
