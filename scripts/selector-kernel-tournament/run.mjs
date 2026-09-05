import { existsSync, mkdirSync } from "node:fs"
import { join, isAbsolute } from "node:path"
import { homedir } from "node:os"
import { randomUUID } from "node:crypto"
import {
    ROOT,
    git,
    requireGate,
    assertClean,
    manifest,
    json,
} from "./inputs.mjs"
import { writeEvidence } from "./evidence.mjs"
import { captureProvenance, freezePlan, validatePlan } from "./provenance.mjs"
import {
    validateFoundationReadiness,
    requireCandidateBase,
} from "./readiness.mjs"
import { validatePriorStage } from "./transitions.mjs"
export const EVIDENCE_ROOT = join(
    homedir(),
    ".gstack/projects/eigilsagafos-valdres/selector-kernel-tournament",
)
export async function initializeRun({
    plan,
    evidenceRoot = EVIDENCE_ROOT,
    foundationSha = git(["rev-parse", "HEAD"]),
    runId = new Date().toISOString().replace(/[:.]/g, "-") +
        "-" +
        randomUUID().slice(0, 8),
    readiness,
    priorStage,
}) {
    assertClean()
    validatePlan(plan)
    requireGate(
        isAbsolute(evidenceRoot) && /^[A-Za-z0-9._:-]+$/.test(runId),
        "RUN-PATH",
        "absolute shared root and simple run ID required",
    )
    requireGate(
        plan.kind !== "control" || plan.stage === "A",
        "RUN-CONTROL",
        "control records all C/A evidence",
    )
    const root = join(
        evidenceRoot,
        foundationSha,
        plan.id,
        String(plan.revision),
        runId,
    )
    requireGate(!existsSync(root), "EVIDENCE-IMMUTABLE", "new run ID required")
    mkdirSync(root, { recursive: true })
    try {
        if (plan.kind === "candidate") {
            requireGate(
                readiness,
                "FOUNDATION-READINESS",
                "merged green/red foundation is required",
            )
            writeEvidence(root, "foundation-readiness.json", readiness)
            await validateFoundationReadiness(root)
            requireGate(
                foundationSha === readiness.frozenFoundationSha,
                "FOUNDATION-CANDIDATE-BASE",
                "foundation differs from readiness",
            )
            requireCandidateBase(plan.gitSha, readiness)
            if (plan.stage !== "C") {
                requireGate(
                    priorStage,
                    "STAGE-PREREQUISITE",
                    "preceding stage evidence required",
                )
                writeEvidence(root, "prior-stage.json", priorStage)
                await validatePriorStage(root, plan)
            }
        }
        const provenance = captureProvenance({
                foundationSha,
                candidateRoot: ROOT,
                kind: plan.kind,
                candidateSha: plan.gitSha,
            }),
            planArtifact = freezePlan(root, plan)
        writeEvidence(root, "provenance.json", provenance)
        const control = {
                timed: "artifacts/control-timed/artifact.json",
                counter: "artifacts/control-counter/artifact.json",
            },
            candidate =
                plan.kind === "control"
                    ? control
                    : {
                          timed: "artifacts/candidate-timed/artifact.json",
                          counter: "artifacts/candidate-counter/artifact.json",
                      }
        const preflights = Object.fromEntries(
            ["C", "A"].map(stage => [
                stage,
                {
                    control:
                        plan.kind === "control"
                            ? `conformance-${stage.toLowerCase()}.json`
                            : `control-conformance-${stage.toLowerCase()}.json`,
                    candidate: `conformance-${stage.toLowerCase()}.json`,
                },
            ]),
        )
        const index = {
            schemaVersion: 3,
            kind: plan.kind,
            runId,
            stage: plan.stage,
            plan: planArtifact,
            artifacts: { control, candidate },
            preflights,
        }
        writeEvidence(root, "run.json", index)
        return { root, index, provenance, planArtifact }
    } catch (error) {
        writeEvidence(root, "invalid-run.json", {
            kind: "invalid-run",
            reason: error.message,
            at: new Date().toISOString(),
        })
        throw error
    }
}
if (import.meta.main) {
    const [action, file, root] = process.argv.slice(2)
    requireGate(
        action === "init" && file,
        "RUN-CLI",
        "usage: run.mjs init PLAN_JSON [SHARED_EVIDENCE_ROOT]",
    )
    console.log(
        JSON.stringify(
            await initializeRun({
                plan: json(file),
                ...(root ? { evidenceRoot: root } : {}),
            }),
        ),
    )
}
