import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import Ajv2020 from "ajv/dist/2020.js"
import {
    ROOT,
    assertClean,
    DIRECTORY,
    manifest,
    reportSchema,
    schemaCheck,
    validateInventoryRows,
    json,
    fileHash,
    requireGate,
    exactRows,
} from "./inputs.mjs"
import {
    writeEvidence,
    evidencePath,
    artifactInventory,
    verifyArtifacts,
    verifySeal,
    sealEvidence,
    same,
    strictKeys,
} from "./evidence.mjs"
import { verifyFrozenPlan } from "./provenance.mjs"
import { validateProvenanceEvidence, readNDJSON } from "./report-inputs.mjs"
import { artifactIdentity } from "./artifact-validation.mjs"
import { validateTimings, validatePreflight } from "./timing-evidence.mjs"
import { verifyPreflightEvidence } from "./preflight.mjs"
import { validateCounters } from "./counter-validation.mjs"
import { validateSourceMemory } from "./source-memory.mjs"
import { decideMemory, decideSizes } from "./resource-validation.mjs"
import { validateComplexity } from "./complexity.mjs"
import { validateProcess } from "./process-evidence.mjs"
import {
    validateSizeEvidence,
    validateMemoryEvidence,
} from "./resource-evidence.mjs"
const summaries = rows =>
    rows.map(
        ({
            raw,
            cIntendedSignal,
            nonRegression,
            tail,
            intendedPass,
            ...row
        }) => ({ ...row, rawEvidence: "timings.ndjson" }),
    )
const gate = (status, evidence) => ({
    status,
    evidence: [evidence],
    firstFailure:
        status === "fail"
            ? {
                  id: "RECORDED-GATE-FAILURE",
                  message: "See raw evidence and recomputed rows",
              }
            : null,
})
export function computeSelection(gates, stage, humanDecision = null) {
    const required =
        stage === "C"
            ? ["provenance", "contractC", "familyCompatibility", "performance"]
            : [
                  "provenance",
                  "contractC",
                  "contractA",
                  "familyCompatibility",
                  "performance",
                  "p95",
                  "memory",
                  "sourceMemory",
                  "size",
                  ...(["shiftx", "integration"].includes(stage)
                      ? ["shiftx"]
                      : []),
              ]
    const reasons = required
        .filter(key => gates[key].status !== "pass")
        .map(key => `${key}: ${gates[key].status}`)
    const machineEligible = reasons.length === 0,
        machineVerdict = machineEligible
            ? "eligible"
            : required.some(key => gates[key].status === "fail")
              ? "ineligible"
              : required.some(key => gates[key].status === "not-run")
                ? "not-complete"
                : "inconclusive"
    requireGate(
        humanDecision?.decision !== "promote" || machineEligible,
        "REPORT-HUMAN-OVERRIDE",
        "human decisions cannot override gates",
    )
    return { machineEligible, machineVerdict, reasons, humanDecision }
}
export function renderReport(report) {
    const lines = [
        `# Selector-kernel tournament: ${report.runId}`,
        "",
        `Kind: ${report.kind ?? "candidate"}. Foundation: \`${report.foundation.gitSha}\`.`,
        "",
    ]
    if (report.kind === "foundation-control")
        lines.push(
            `Control bundle: **${report.status}**. Beta.36 has no intended-win obligation or candidate eligibility field.`,
            "",
        )
    else
        lines.push(
            `Candidate: ${report.candidate.id}, revision ${report.candidate.revision}, stage ${report.candidate.stage}. Machine verdict: **${report.selection.machineVerdict}**.`,
            "",
        )
    lines.push(
        "| Gate | Status | Evidence |",
        "| --- | --- | --- |",
        ...Object.entries(report.gates).map(
            ([id, g]) => `| ${id} | ${g.status} | ${g.evidence.join(", ")} |`,
        ),
        "",
    )
    const groups =
        report.kind === "foundation-control"
            ? Object.entries(report.timings)
            : [[report.candidate.stage, report.workloads]]
    for (const [stage, rows] of groups) {
        lines.push(
            `## ${stage} timing observations`,
            "",
            "| Lane/runtime | Pairs | Ratio | 90% interval | p95 ratio | Status |",
            "| --- | ---: | ---: | --- | ---: | --- |",
            ...rows.map(
                r =>
                    `| ${r.id}/${r.runtime} | ${r.pairs} | ${r.estimateRatio.toFixed(6)} | ${r.interval90.map(n => n.toFixed(6)).join("–")} | ${r.p95Ratio.toFixed(6)} | ${r.status} |`,
            ),
            "",
        )
    }
    lines.push(
        "Raw process observations, exact commands, hashes, and separate hypothesis decisions are in the linked JSON evidence. Family compatibility is frozen and non-scoring. Counter-process retained heap is diagnostic; packed paired memory uses uninstrumented artifacts; source absolute memory uses the unchanged eight-scenario harness.",
        "",
    )
    return lines.join("\n")
}
export async function recomputeReport(root, { humanDecision = null } = {}) {
    const index = json(evidencePath(root, "run.json"))
    strictKeys(
        index,
        [
            "schemaVersion",
            "kind",
            "runId",
            "stage",
            "plan",
            "artifacts",
            "preflights",
        ],
        "REPORT-RUN-SCHEMA",
    )
    requireGate(
        index.schemaVersion === 3 &&
            ["control", "candidate"].includes(index.kind) &&
            ["C", "A", "shiftx", "integration"].includes(index.stage) &&
            /^[A-Za-z0-9._:-]+$/.test(index.runId),
        "REPORT-RUN-SCHEMA",
        "invalid identity",
    )
    for (const arm of ["control", "candidate"])
        strictKeys(
            index.artifacts[arm],
            ["timed", "counter"],
            "REPORT-RUN-SCHEMA",
        )
    strictKeys(index.artifacts, ["control", "candidate"], "REPORT-RUN-SCHEMA")
    strictKeys(index.preflights, ["C", "A"], "REPORT-RUN-SCHEMA")
    for (const value of Object.values(index.preflights))
        strictKeys(value, ["control", "candidate"], "REPORT-RUN-SCHEMA")
    const plan = verifyFrozenPlan(root, index.plan)
    if (index.kind === "candidate") {
        const { validateFoundationReadiness, requireCandidateBase } =
            await import("./readiness.mjs")
        const readiness = await validateFoundationReadiness(root)
        requireCandidateBase(plan.gitSha, readiness)
    }
    const { validatePriorStage } = await import("./transitions.mjs")
    await validatePriorStage(root, plan)
    requireGate(
        plan.kind === index.kind && plan.stage === index.stage,
        "PLAN-IDENTITY",
        "plan differs from run",
    )
    const {
        value: provenance,
        artifacts,
        inputs,
    } = validateProvenanceEvidence(root, index)
    requireGate(
        provenance.kind === index.kind &&
            plan.gitSha === provenance.candidateSha,
        "PROVENANCE-IDENTITY",
        "plan and provenance differ",
    )
    const cache = new Map(),
        stages =
            index.kind === "control"
                ? ["C", "A"]
                : [index.stage === "C" ? "C" : "A"],
        decisions = {},
        semantic = []
    for (const stage of stages) {
        for (const arm of ["control", "candidate"]) {
            const preflight = json(
                evidencePath(root, index.preflights[stage][arm]),
            )
            validatePreflight(preflight, stage, artifacts[arm].timed)
            verifyPreflightEvidence(root, preflight, artifacts[arm], cache)
            if (arm === "candidate" && stage === stages.at(-1))
                semantic.push(
                    ...preflight.rows
                        .filter(r => r.mode === "public")
                        .map(r => ({
                            id: r.id,
                            runtime: r.runtime,
                            status: r.status,
                            evidence: r.evidence,
                        })),
                )
        }
        const records = (await readNDJSON(root, "timings.ndjson")).filter(
            r => r.stage === stage,
        )
        same(
            records,
            await readNDJSON(root, `timing-${stage}/timings.ndjson`),
            "PROVENANCE-RESULT-ROW",
            "aggregate observations differ",
        )
        requireGate(
            json(evidencePath(root, `timing-${stage}/schedule.json`))
                .planSha256 === index.plan.sha256,
            "PROVENANCE-INTENT-HASH",
            "intent was not frozen before timing",
        )
        decisions[stage] = validateTimings(root, records, {
            stage,
            plan,
            artifacts: {
                control: artifacts.control.timed,
                candidate: artifacts.candidate.timed,
            },
        })
    }
    requireGate(
        (await readNDJSON(root, "timings.ndjson")).every(row =>
            stages.includes(row.stage),
        ),
        "TIMING-STAGE",
        "unknown or unused sample stage",
    )
    same(
        json(evidencePath(root, "timing-decisions.json")),
        decisions,
        "PROVENANCE-RESULT-ROW",
        "statistics differ from raw samples",
    )
    const stage = index.stage === "C" ? "C" : "A",
        counters = validateCounters(
            root,
            json(evidencePath(root, "counters.json")),
            {
                stage,
                artifact: artifacts.candidate.counter,
                kind: index.kind,
                id: plan.id,
            },
        )
    // Resource executors write exact process evidence. Their format is validated
    // here before summary arithmetic; no report-supplied pass bit is accepted.
    const memoryRecords = await readNDJSON(root, "memory.ndjson")
    validateMemoryEvidence(root, memoryRecords, { artifacts })
    const memory = memoryRecords.length ? decideMemory(memoryRecords) : []
    requireGate(
        stage === "C" || memory.length === 12,
        "MEMORY-INVENTORY",
        "memory evidence missing",
    )
    const sourceMemory = validateSourceMemory(
        root,
        json(evidencePath(root, "source-memory.json")),
        { artifacts, index },
    )
    const sizes = json(evidencePath(root, "sizes.json"))
    validateSizeEvidence(root, sizes, { artifacts, index })
    const size = decideSizes(sizes.control, sizes.candidate, sizes.baseline)
    const completion = json(evidencePath(root, "completion.json"))
    strictKeys(completion, ["endedAt"], "PROVENANCE-COMPLETION")
    requireGate(
        Number.isFinite(Date.parse(completion.endedAt)) &&
            Date.parse(completion.endedAt) >= Date.parse(provenance.startedAt),
        "PROVENANCE-COMPLETION",
        "invalid end",
    )
    const decision = decisions[stage],
        gates = {
            provenance: gate("pass", "provenance.json"),
            contractC: gate("pass", index.preflights[stages.at(-1)].candidate),
            contractA: gate(
                stage === "A" ? "pass" : "not-run",
                "conformance-a.json",
            ),
            familyCompatibility: gate(
                "pass",
                index.preflights[stages.at(-1)].candidate,
            ),
            performance: gate(
                decision.performanceStatus,
                "timing-decisions.json",
            ),
            p95: gate(
                stage === "A" ? decision.tailStatus : "not-run",
                "timing-decisions.json",
            ),
            sourceMemory: gate("pass", "source-memory.json"),
            memory: gate(
                memory.length
                    ? memory.every(r => r.status === "pass")
                        ? "pass"
                        : "fail"
                    : "not-run",
                "memory.ndjson",
            ),
            size: gate(
                size.every(r => r.status === "pass") ? "pass" : "fail",
                "sizes.json",
            ),
            shiftx: gate("not-run", "run.json"),
        }
    const control = {
        ...artifactIdentity(artifacts.control.timed),
        packageVersion: manifest.control.packageVersion,
        tag: manifest.control.tag,
    }
    const resources = {
        sourceMemoryEvidence: "source-memory.json",
        sourceMemory,
        memoryEvidence: "memory.ndjson",
        sizeEvidence: "sizes.json",
        memory,
        size,
    }
    if (index.kind === "control") {
        requireGate(
            plan.id === "beta36-control" &&
                plan.intendedWorkloads.length === 0 &&
                stage === "A",
            "REPORT-CONTROL",
            "control must run all stages without intended wins",
        )
        const calibration = Object.fromEntries(
            stages.map(s => [
                s,
                Object.fromEntries(
                    [
                        "performanceStatus",
                        "tailStatus",
                        "intendedWinRequired",
                        "intendedWinEstablished",
                    ].map(k => [k, decisions[s][k]]),
                ),
            ]),
        )
        // A/A latency estimates describe runner noise. Beta.36 is the fixed fallback,
        // not a candidate seeking a 15% win. Raw non-regression and tail decisions
        // remain visible, including inconclusive/fail; they cannot admit candidates.
        const controlGates = Object.fromEntries(
            Object.entries(gates).filter(
                ([key]) => !["performance", "p95", "shiftx"].includes(key),
            ),
        )
        const result = {
            schemaVersion: 3,
            tournamentId: manifest.id,
            kind: "foundation-control",
            runId: index.runId,
            foundation: provenance.foundation,
            control,
            provenance: { evidence: "provenance.json", inputs },
            gates: controlGates,
            status: Object.values(controlGates).every(g => g.status === "pass")
                ? "pass"
                : "fail",
            semanticCases: semantic,
            timings: Object.fromEntries(
                stages.map(s => [s, summaries(decisions[s].rows)]),
            ),
            calibration,
            counters: { evidence: "counters.json", rows: counters },
            resources,
            artifacts: artifactInventory(root),
        }
        validateControlShape(result)
        return result
    }
    const { complexity, hostHooks, frozenDiffSha256 } = validateComplexity(
        root,
        {
            foundationSha: provenance.foundation.gitSha,
            candidateSha: plan.gitSha,
            plan,
        },
    )
    const reviews = {
        codex: artifactInventory(root).find(a => a.path === "reviews/codex.md"),
        otherVendor: artifactInventory(root).find(
            a => a.path === "reviews/other-vendor.md",
        ),
        dispositions: artifactInventory(root).find(
            a => a.path === "reviews/dispositions.json",
        ),
    }
    requireGate(
        Object.values(reviews).every(Boolean),
        "REPORT-REVIEW-EVIDENCE",
        "missing review artifact",
    )
    validateReviewDispositions(
        json(evidencePath(root, "reviews/dispositions.json")),
    )
    const timed = artifacts.candidate.timed,
        report = {
            schemaVersion: 3,
            tournamentId: manifest.id,
            runId: index.runId,
            candidate: {
                id: plan.id,
                revision: plan.revision,
                stage: plan.stage,
                branch: manifest.implementations.find(i => i.id === plan.id)
                    .branch,
                intendedWorkloads: plan.intendedWorkloads,
                candidatePlanSha256: index.plan.sha256,
                frozenDiffSha256,
            },
            foundation: provenance.foundation,
            control,
            comparisonBaselines: { pre28Claim: null },
            provenance: {
                status: "pass",
                candidateIdentity: artifactIdentity(timed),
                cleanWorktree: true,
                build: {
                    command: timed.buildCommand,
                    bundler: timed.bundler,
                    minifier: timed.minifier,
                    flags: timed.flags,
                    exportConditions: timed.exportConditions,
                    packageManifestSha256: timed.packageManifestSha256,
                    lockfileSha256: timed.lockfileSha256,
                },
                runner: provenance.runner,
                inputs,
                startedAt: provenance.startedAt,
                endedAt: completion.endedAt,
                evidence: "provenance.json",
            },
            gates,
            semanticCases: semantic,
            workloads: summaries(decision.rows),
            counters: { evidence: "counters.json", rows: counters },
            resources,
            complexity,
            hostHooks,
            reviews,
            artifacts: artifactInventory(root),
            selection: computeSelection(gates, plan.stage, humanDecision),
        }
    if (["shiftx", "integration"].includes(plan.stage)) {
        const { validateShiftx } = await import("./shiftx.mjs")
        const external = await validateShiftx(root, {
            candidateSha: plan.gitSha,
            controlIdentity: artifactIdentity(artifacts.control.timed),
            candidateIdentity: artifactIdentity(timed),
        })
        report.gates.shiftx = gate(external.status, "shiftx-timings.ndjson")
        report.workloads.push(...external.rows)
        report.comparisonBaselines.pre28Claim = external.pre28Claim
        report.provenance.runner = {
            ...provenance.runner,
            browser: external.browser,
        }
        report.selection = computeSelection(
            report.gates,
            plan.stage,
            humanDecision,
        )
    }
    schemaCheck(report)
    validateInventoryRows(report)
    return report
}
export function validateReviewDispositions(value) {
    strictKeys(value, ["schemaVersion", "findings"], "REVIEW-SCHEMA")
    requireGate(
        value.schemaVersion === 3 &&
            Array.isArray(value.findings) &&
            new Set(value.findings.map(f => f.id)).size ===
                value.findings.length,
        "REVIEW-SCHEMA",
        "invalid findings",
    )
    for (const finding of value.findings) {
        strictKeys(
            finding,
            ["id", "finding", "disposition", "evidence"],
            "REVIEW-SCHEMA",
        )
        requireGate(
            typeof finding.finding === "string" &&
                [
                    "fixed",
                    "reproduced-gate-failure",
                    "not-reproduced",
                    "out-of-scope",
                ].includes(finding.disposition) &&
                Array.isArray(finding.evidence) &&
                finding.evidence.length > 0,
            "REVIEW-SCHEMA",
            "unrecorded disposition",
        )
    }
}
let validateControl
export function validateControlShape(report) {
    if (!validateControl) {
        const ajv = new Ajv2020({ strict: true, strictRequired: false })
        validateControl = ajv.compile(
            json(join(ROOT, DIRECTORY, "control-report.schema.json")),
        )
    }
    requireGate(
        validateControl(report),
        "REPORT-CONTROL-SCHEMA",
        JSON.stringify(validateControl.errors),
    )
}
export async function validateReportBundle(root, expectedSums) {
    assertClean()
    verifySeal(root, expectedSums)
    const report = json(evidencePath(root, "report.json"))
    if (report.kind === "foundation-control") validateControlShape(report)
    else schemaCheck(report)
    const required =
        report.kind === "foundation-control"
            ? manifest.requiredEvidenceFiles
                  .filter(
                      p =>
                          ![
                              "candidate-plan.json",
                              "host-hooks.json",
                              "complexity.json",
                              "reviews/codex.md",
                              "reviews/other-vendor.md",
                              "reviews/dispositions.json",
                          ].includes(p),
                  )
                  .concat("control-plan.json")
            : manifest.requiredEvidenceFiles
    for (const path of required)
        requireGate(
            existsSync(evidencePath(root, path)),
            "EVIDENCE-MISSING",
            path,
        )
    verifyArtifacts(root, report.artifacts)
    const recomputed = await recomputeReport(root, {
        humanDecision: report.selection?.humanDecision ?? null,
    })
    same(
        report,
        recomputed,
        "REPORT-RECOMPUTATION",
        "report differs from machine evidence",
    )
    same(
        readFileSync(evidencePath(root, "report.md"), "utf8"),
        renderReport(report),
        "REPORT-RENDER",
        "Markdown is not a rendering of JSON",
    )
    return report
}
export async function finalizeReport(root) {
    requireGate(
        !existsSync(join(root, "report.json")),
        "EVIDENCE-IMMUTABLE",
        "report exists",
    )
    const report = await recomputeReport(root)
    writeEvidence(root, "report.json", report)
    writeEvidence(root, "report.md", renderReport(report))
    const sums = sealEvidence(root)
    await validateReportBundle(root, sums)
    return { report, sha256sums: sums }
}
if (import.meta.main) {
    const [action, root, hash] = process.argv.slice(2)
    requireGate(
        action === "validate",
        "REPORT-CLI",
        "usage: report.mjs validate ROOT [SHA256SUMS_HASH]",
    )
    console.log(JSON.stringify(await validateReportBundle(root, hash)))
}
