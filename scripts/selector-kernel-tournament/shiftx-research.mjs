import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { isAbsolute } from "node:path"
import {
    manifest,
    json,
    requireGate,
    exactRows,
    fileHash,
    sha256 as sha256Hex,
    git,
    schemaCheck,
} from "./inputs.mjs"
import { evidencePath, same, strictKeys, verifySeal } from "./evidence.mjs"
import { validateShiftx } from "./shiftx.mjs"
import {
    artifactIdentity,
    validateArtifactEvidence,
} from "./artifact-validation.mjs"

export const PRESERVED_RESEARCH_CANDIDATES = Object.freeze({
    "incumbent-lite": Object.freeze({
        gitSha: "8192de293f76022f27f06606614e71ab7bddf25b",
        contractCGitSha: "8192de293f76022f27f06606614e71ab7bddf25b",
        diffSha256:
            "fbf9e5ba64d09412ecfed90a1bab1e56b502aa934e5c8aef14d23591ae0368c3",
        contractCSha256sums:
            "7aa4292f2bdef321d6f8e951114b71c1a1f7d0941196d85dce0605fcdb4058f5",
    }),
    "reactive-currentness": Object.freeze({
        gitSha: "2558104cbc4c87cac9ca38f13f65de23291db0d7",
        contractCGitSha: "2558104cbc4c87cac9ca38f13f65de23291db0d7",
        diffSha256:
            "4ff405a93fe98e968126408bb36c80a3598c49fa8f72749b867b32729bb29bf0",
        contractCSha256sums:
            "0903dcccdd4ca6065aa96eb0e3d324fbefb408c2b6060f963ff0a26c5c86563b",
    }),
    "dynamic-topological": Object.freeze({
        gitSha: "38db343bbf1329cfbaaf80ad883df907e2810125",
        contractCGitSha: "3d072f92ca9d2d0007a60cdd22bf916511766d86",
        diffSha256:
            "3f1de568e8e7d3c12858258918a7d1205ba041b35d2aa2d4827b15eb17c5e26d",
        contractCSha256sums:
            "f93010be543992775006150a03c6d3e48853e6a6d160de327c940476f7e00086",
    }),
})

const isSha256 = value =>
    typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const gitSha = value =>
    typeof value === "string" && /^[a-f0-9]{40}$/.test(value)
const nonempty = value => typeof value === "string" && value.length > 0
const status = value =>
    ["pass", "fail", "inconclusive", "not-run"].includes(value)
const completed = value => ["pass", "fail", "inconclusive"].includes(value)
const finitePositive = value => Number.isFinite(value) && value > 0
const jsonClone = value => JSON.parse(JSON.stringify(value))
const PROTECTED_BASELINE = "beta36-control"
const RAW_SHIFTX_EVIDENCE = "shiftx-timings.ndjson"
const PAIR_LADDER = [8, 12, 16, 20]
const PROTECTED_NULL_RATIO = 1.1
const TAIL_RATIO_LIMIT = 1.2

function validateReference(value, id) {
    strictKeys(value, ["path", "sha256"], id)
    requireGate(
        nonempty(value.path) && isSha256(value.sha256),
        id,
        "invalid evidence reference",
    )
}

function validateBundleReference(value) {
    strictKeys(value, ["path", "sha256sums"], "SHIFTX-RESEARCH-CONTRACT-C")
    requireGate(
        isAbsolute(value.path) && isSha256(value.sha256sums),
        "SHIFTX-RESEARCH-CONTRACT-C",
        "invalid Contract C bundle reference",
    )
}

function validateDiagnostic(value, id) {
    strictKeys(value, ["status", "rows"], id)
    requireGate(
        status(value.status) && Array.isArray(value.rows),
        id,
        "invalid diagnostic result",
    )
}

function validateSmoke(value) {
    strictKeys(
        value,
        ["status", "checksum", "consoleErrors", "publicErrors", "evidence"],
        "SHIFTX-RESEARCH-SMOKE",
    )
    requireGate(
        value.status === "pass" &&
            nonempty(value.checksum) &&
            Array.isArray(value.consoleErrors) &&
            value.consoleErrors.length === 0 &&
            Array.isArray(value.publicErrors) &&
            value.publicErrors.length === 0,
        "SHIFTX-RESEARCH-SMOKE",
        "public smoke did not pass cleanly",
    )
    validateReference(value.evidence, "SHIFTX-RESEARCH-SMOKE")
}

export function validateShiftxResearchAdmission(admission) {
    strictKeys(
        admission,
        [
            "candidateId",
            "contractC",
            "source",
            "replay",
            "execution",
            "build",
            "smoke",
        ],
        "SHIFTX-RESEARCH-ADMISSION",
    )
    const preserved = PRESERVED_RESEARCH_CANDIDATES[admission.candidateId]
    requireGate(preserved, "SHIFTX-RESEARCH-CANDIDATE", "unknown candidate")

    strictKeys(
        admission.source,
        ["gitSha", "diffSha256"],
        "SHIFTX-RESEARCH-SOURCE",
    )
    requireGate(
        admission.source.gitSha === preserved.gitSha &&
            admission.source.diffSha256 === preserved.diffSha256,
        "SHIFTX-RESEARCH-SOURCE",
        "source revision or diff is not preserved",
    )

    strictKeys(
        admission.replay,
        ["baseGitSha", "gitSha", "diffSha256", "review"],
        "SHIFTX-RESEARCH-REPLAY",
    )
    requireGate(
        gitSha(admission.replay.baseGitSha) &&
            gitSha(admission.replay.gitSha) &&
            admission.replay.baseGitSha !== admission.replay.gitSha &&
            admission.replay.gitSha !== admission.source.gitSha &&
            isSha256(admission.replay.diffSha256),
        "SHIFTX-RESEARCH-REPLAY",
        "replay identity is invalid",
    )
    validateReference(admission.replay.review, "SHIFTX-RESEARCH-REPLAY-REVIEW")

    strictKeys(
        admission.execution,
        ["candidateOrder", "researchBaseGitSha", "frozenAt", "evidence"],
        "SHIFTX-RESEARCH-ORDER",
    )
    exactRows(
        Array.isArray(admission.execution.candidateOrder)
            ? admission.execution.candidateOrder
            : [],
        Object.keys(PRESERVED_RESEARCH_CANDIDATES),
        "SHIFTX-RESEARCH-ORDER",
    )
    requireGate(
        admission.execution.researchBaseGitSha ===
            admission.replay.baseGitSha &&
            Number.isFinite(Date.parse(admission.execution.frozenAt)),
        "SHIFTX-RESEARCH-ORDER",
        "candidate order must be recorded before timing",
    )
    validateReference(admission.execution.evidence, "SHIFTX-RESEARCH-ORDER")

    strictKeys(
        admission.build,
        [
            "command",
            "cleanWorktree",
            "packageArtifactSha256",
            "entry",
            "evidence",
        ],
        "SHIFTX-RESEARCH-BUILD",
    )
    strictKeys(
        admission.build.entry,
        ["path", "sha256"],
        "SHIFTX-RESEARCH-BUILD",
    )
    requireGate(
        admission.build.cleanWorktree === true &&
            nonempty(admission.build.command) &&
            isSha256(admission.build.packageArtifactSha256) &&
            admission.build.entry.path === "package/dist/index.js" &&
            isSha256(admission.build.entry.sha256),
        "SHIFTX-RESEARCH-BUILD",
        "clean package build identity is required",
    )
    validateReference(admission.build.evidence, "SHIFTX-RESEARCH-BUILD")
    validateSmoke(admission.smoke)

    strictKeys(
        admission.contractC,
        [
            "bundle",
            "candidateIdentity",
            "provenanceStatus",
            "publicSemantics",
            "diagnostics",
        ],
        "SHIFTX-RESEARCH-CONTRACT-C",
    )
    validateBundleReference(admission.contractC.bundle)
    requireGate(
        admission.contractC.bundle.sha256sums === preserved.contractCSha256sums,
        "SHIFTX-RESEARCH-CONTRACT-C",
        "Contract C bundle seal is not preserved",
    )
    strictKeys(
        admission.contractC.candidateIdentity,
        ["id", "gitSha", "diffSha256"],
        "SHIFTX-RESEARCH-CONTRACT-C",
    )
    requireGate(
        admission.contractC.candidateIdentity.id === admission.candidateId &&
            admission.contractC.candidateIdentity.gitSha ===
                preserved.contractCGitSha &&
            admission.contractC.candidateIdentity.diffSha256 ===
                admission.source.diffSha256 &&
            admission.contractC.provenanceStatus === "pass" &&
            Array.isArray(admission.contractC.publicSemantics),
        "SHIFTX-RESEARCH-CONTRACT-C",
        "Contract C provenance did not pass",
    )
    const requiredCases = manifest.semanticCases
        .filter(row => row.requiredAt.includes("C"))
        .flatMap(row => ["bun", "node"].map(runtime => `${row.id}/${runtime}`))
    for (const row of admission.contractC.publicSemantics) {
        strictKeys(
            row,
            ["id", "runtime", "status", "evidence"],
            "SHIFTX-RESEARCH-CONTRACT-C",
        )
        requireGate(
            ["bun", "node"].includes(row.runtime) &&
                row.status === "pass" &&
                nonempty(row.evidence),
            "SHIFTX-RESEARCH-CONTRACT-C",
            "Contract C public semantics did not pass under Bun and Node",
        )
    }
    exactRows(
        admission.contractC.publicSemantics.map(
            row => `${row.id}/${row.runtime}`,
        ),
        requiredCases,
        "SHIFTX-RESEARCH-CONTRACT-C",
    )
    strictKeys(
        admission.contractC.diagnostics,
        ["performance", "p95", "memory", "size"],
        "SHIFTX-RESEARCH-DIAGNOSTICS",
    )
    for (const [name, value] of Object.entries(admission.contractC.diagnostics))
        validateDiagnostic(
            value,
            `SHIFTX-RESEARCH-DIAGNOSTIC-${name.toUpperCase()}`,
        )
    return admission
}

export async function validateRecordedContractC(admission) {
    validateShiftxResearchAdmission(admission)
    const reference = admission.contractC.bundle
    verifySeal(reference.path, reference.sha256sums)
    const report = json(evidencePath(reference.path, "report.json"))
    schemaCheck(report)
    requireGate(
        report.candidate?.id === admission.candidateId &&
            report.candidate.stage === "C" &&
            report.candidate.frozenDiffSha256 === admission.source.diffSha256 &&
            report.provenance?.status === "pass" &&
            report.provenance.candidateIdentity?.gitSha ===
                admission.contractC.candidateIdentity.gitSha &&
            report.gates?.provenance?.status === "pass" &&
            report.gates.contractC?.status === "pass",
        "SHIFTX-RESEARCH-CONTRACT-C-REPORT",
        "recorded report does not prove this candidate's C provenance",
    )
    same(
        admission.contractC.publicSemantics,
        report.semanticCases,
        "SHIFTX-RESEARCH-CONTRACT-C-REPORT",
        "public semantics differ from the recorded report",
    )
    same(
        admission.contractC.diagnostics,
        {
            performance: {
                status: report.gates.performance.status,
                rows: report.workloads,
            },
            p95: {
                status: report.gates.p95.status,
                rows: report.workloads,
            },
            memory: {
                status: report.gates.memory.status,
                rows: report.resources.memory,
            },
            size: {
                status: report.gates.size.status,
                rows: report.resources.size,
            },
        },
        "SHIFTX-RESEARCH-CONTRACT-C-REPORT",
        "diagnostics differ from the recorded report",
    )
    return report
}

function validateRecordedReference(root, reference, id) {
    requireGate(
        fileHash(evidencePath(root, reference.path)) === reference.sha256,
        id,
        "recorded evidence differs",
    )
}

export function validateReplayReview(root, admission) {
    validateShiftxResearchAdmission(admission)
    validateRecordedReference(
        root,
        admission.replay.review,
        "SHIFTX-RESEARCH-REPLAY-REVIEW",
    )
    const replayReview = json(evidencePath(root, admission.replay.review.path))
    strictKeys(
        replayReview,
        [
            "schemaVersion",
            "candidateId",
            "source",
            "replay",
            "status",
            "reviewer",
            "reviewedAt",
        ],
        "SHIFTX-RESEARCH-REPLAY-REVIEW",
    )
    requireGate(
        replayReview.schemaVersion === 1 &&
            replayReview.candidateId === admission.candidateId &&
            replayReview.status === "pass" &&
            nonempty(replayReview.reviewer) &&
            Number.isFinite(Date.parse(replayReview.reviewedAt)),
        "SHIFTX-RESEARCH-REPLAY-REVIEW",
        "trusted replay review did not pass",
    )
    same(
        replayReview.source,
        admission.source,
        "SHIFTX-RESEARCH-REPLAY-REVIEW",
        "reviewed source identity differs",
    )
    same(
        replayReview.replay,
        Object.fromEntries(
            Object.entries(admission.replay).filter(
                ([key]) => key !== "review",
            ),
        ),
        "SHIFTX-RESEARCH-REPLAY-REVIEW",
        "reviewed replay identity differs",
    )
    return replayReview
}

function validateResearchInputs(root, admission, controlBuild) {
    validateReplayReview(root, admission)
    validateRecordedReference(
        root,
        admission.execution.evidence,
        "SHIFTX-RESEARCH-ORDER",
    )
    same(
        json(evidencePath(root, admission.execution.evidence.path)),
        {
            candidateOrder: admission.execution.candidateOrder,
            researchBaseGitSha: admission.execution.researchBaseGitSha,
            frozenAt: admission.execution.frozenAt,
        },
        "SHIFTX-RESEARCH-ORDER",
        "candidate order record differs",
    )
    validateRecordedReference(
        root,
        admission.smoke.evidence,
        "SHIFTX-RESEARCH-SMOKE",
    )
    same(
        json(evidencePath(root, admission.smoke.evidence.path)),
        Object.fromEntries(
            Object.entries(admission.smoke).filter(
                ([key]) => key !== "evidence",
            ),
        ),
        "SHIFTX-RESEARCH-SMOKE",
        "smoke record differs",
    )
    validateRecordedReference(
        root,
        admission.build.evidence,
        "SHIFTX-RESEARCH-BUILD",
    )
    validateReference(controlBuild, "SHIFTX-RESEARCH-CONTROL-BUILD")
    validateRecordedReference(
        root,
        controlBuild,
        "SHIFTX-RESEARCH-CONTROL-BUILD",
    )
    const candidate = validateArtifactEvidence(
            root,
            admission.build.evidence.path,
            { gitSha: admission.replay.gitSha, mode: "timed" },
        ),
        control = validateArtifactEvidence(root, controlBuild.path, {
            gitSha: manifest.control.gitSha,
            mode: "timed",
        })
    requireGate(
        candidate.repositoryDirty === false &&
            candidate.buildCommand === admission.build.command &&
            candidate.tarballSha256 === admission.build.packageArtifactSha256 &&
            candidate.productionEntrySha256 === admission.build.entry.sha256,
        "SHIFTX-RESEARCH-BUILD",
        "measured package is not the recorded clean replay build",
    )
    return { candidate, control }
}

export function validateReplayIdentity(
    candidateRoot,
    admission,
    researchBaseGitSha,
) {
    validateShiftxResearchAdmission(admission)
    let replayMatches = false
    let diff
    try {
        replayMatches =
            gitSha(researchBaseGitSha) &&
            admission.replay.baseGitSha === researchBaseGitSha &&
            typeof candidateRoot === "string" &&
            isAbsolute(candidateRoot) &&
            git(["rev-parse", "HEAD"], candidateRoot) ===
                admission.replay.gitSha &&
            git(
                ["status", "--porcelain=v1", "--untracked-files=all"],
                candidateRoot,
            ) === "" &&
            git(
                ["cat-file", "-t", `${admission.replay.baseGitSha}^{commit}`],
                candidateRoot,
            ) === "commit" &&
            git(
                ["rev-list", "--parents", "-n", "1", admission.replay.gitSha],
                candidateRoot,
            ) === `${admission.replay.gitSha} ${admission.replay.baseGitSha}`
        if (replayMatches) {
            diff = execFileSync(
                "git",
                [
                    "diff",
                    "--binary",
                    "--no-ext-diff",
                    admission.replay.baseGitSha,
                    admission.replay.gitSha,
                ],
                { cwd: candidateRoot, maxBuffer: 64 * 1024 * 1024 },
            )
        }
    } catch {
        replayMatches = false
    }
    requireGate(
        replayMatches &&
            diff !== undefined &&
            sha256Hex(diff) === admission.replay.diffSha256,
        "SHIFTX-RESEARCH-REPLAY",
        "replay commits, clean worktree, or diff identity do not match",
    )
    return admission.replay
}

const probability = value => Number.isFinite(value) && value >= 0 && value <= 1

function validateDecision(value, pairs) {
    strictKeys(
        value,
        [
            "benchmark",
            "runtime",
            "suite",
            "family",
            "outcome",
            "flags",
            "pairs",
            "estimateLn",
            "estimatePct",
            "standardErrorLn",
            "degreesOfFreedom",
            "intervalPct",
            "regressionP",
            "withinBudgetP",
            "regressionQ",
            "withinBudgetQ",
            "logRatios",
        ],
        "SHIFTX-RESEARCH-DECISION",
    )
    requireGate(
        manifest.shiftxWorkloads.some(row => row.id === value.benchmark) &&
            value.runtime === "chrome" &&
            value.suite === "selector-kernel-shiftx" &&
            value.family === "protected" &&
            ["within-budget", "regression", "inconclusive"].includes(
                value.outcome,
            ) &&
            Array.isArray(value.flags) &&
            value.flags.every(nonempty) &&
            value.pairs === pairs &&
            [
                value.estimateLn,
                value.estimatePct,
                value.standardErrorLn,
                value.degreesOfFreedom,
            ].every(Number.isFinite) &&
            Array.isArray(value.intervalPct) &&
            value.intervalPct.length === 2 &&
            value.intervalPct.every(Number.isFinite) &&
            [
                value.regressionP,
                value.withinBudgetP,
                value.regressionQ,
                value.withinBudgetQ,
            ].every(probability) &&
            Array.isArray(value.logRatios) &&
            value.logRatios.length === pairs &&
            value.logRatios.every(Number.isFinite),
        "SHIFTX-RESEARCH-DECISION",
        "malformed paired decision",
    )
}

function validateShiftxRow(row) {
    strictKeys(
        row,
        [
            "id",
            "runtime",
            "baselineId",
            "protected",
            "intended",
            "status",
            "pairs",
            "baselineP50",
            "candidateP50",
            "baselineP95",
            "candidateP95",
            "p95Ratio",
            "estimateRatio",
            "interval90",
            "decisions",
            "flags",
            "rawEvidence",
        ],
        "SHIFTX-RESEARCH-ROW",
    )
    requireGate(
        manifest.shiftxWorkloads.some(workload => workload.id === row.id) &&
            row.runtime === "chrome" &&
            row.baselineId === PROTECTED_BASELINE &&
            row.protected === true &&
            row.intended === false &&
            completed(row.status) &&
            PAIR_LADDER.includes(row.pairs) &&
            [
                row.baselineP50,
                row.candidateP50,
                row.baselineP95,
                row.candidateP95,
                row.p95Ratio,
                row.estimateRatio,
            ].every(finitePositive) &&
            Array.isArray(row.interval90) &&
            row.interval90.length === 2 &&
            row.interval90.every(finitePositive) &&
            Array.isArray(row.flags) &&
            row.flags.every(nonempty) &&
            row.rawEvidence === RAW_SHIFTX_EVIDENCE,
        "SHIFTX-RESEARCH-ROW",
        "invalid completed ShiftX row",
    )
    strictKeys(
        row.decisions,
        ["protectedNonRegression", "intendedWin", "pre28Claim"],
        "SHIFTX-RESEARCH-ROW",
    )
    strictKeys(
        row.decisions.protectedNonRegression,
        ["nullRatio", "alternative", "pValue", "qValue", "status"],
        "SHIFTX-RESEARCH-ROW",
    )
    requireGate(
        row.decisions.protectedNonRegression.nullRatio ===
            PROTECTED_NULL_RATIO &&
            row.decisions.protectedNonRegression.alternative === "less" &&
            probability(row.decisions.protectedNonRegression.pValue) &&
            probability(row.decisions.protectedNonRegression.qValue) &&
            completed(row.decisions.protectedNonRegression.status) &&
            row.decisions.intendedWin === null &&
            row.decisions.pre28Claim === null,
        "SHIFTX-RESEARCH-ROW",
        "research row is not the protected beta.36 decision",
    )
}

function validateProfile(profile) {
    strictKeys(
        profile,
        [
            "id",
            "pairId",
            "arm",
            "process",
            "processSha256",
            "trace",
            "traceSha256",
            "profileTimelineSha256",
        ],
        "SHIFTX-RESEARCH-PROFILE",
    )
    requireGate(
        manifest.shiftxWorkloads.some(workload => workload.id === profile.id) &&
            /^\d+$/.test(profile.pairId) &&
            ["control", "candidate"].includes(profile.arm) &&
            nonempty(profile.process) &&
            isSha256(profile.processSha256) &&
            nonempty(profile.trace) &&
            isSha256(profile.traceSha256) &&
            isSha256(profile.profileTimelineSha256),
        "SHIFTX-RESEARCH-PROFILE",
        "invalid profile reference",
    )
}

export function validateShiftxResearchReport(report) {
    strictKeys(
        report,
        [
            "schemaVersion",
            "kind",
            "promotional",
            "runId",
            "candidate",
            "admission",
            "baselineBuild",
            "applicationBuild",
            "browser",
            "correctness",
            "shiftx",
        ],
        "SHIFTX-RESEARCH-REPORT",
    )
    requireGate(
        report.schemaVersion === 1 &&
            report.kind === "shiftx-research" &&
            report.promotional === false &&
            typeof report.runId === "string" &&
            report.runId.length <= 256 &&
            /^[A-Za-z0-9._:-]+$/.test(report.runId),
        "SHIFTX-RESEARCH-REPORT",
        "report is not explicitly non-promotional research",
    )
    const rejectPromotionFields = value => {
        if (!value || typeof value !== "object") return
        for (const [key, child] of Object.entries(value)) {
            requireGate(
                ![
                    "selection",
                    "machineEligible",
                    "machineVerdict",
                    "humanDecision",
                    "promotionDecision",
                ].includes(key),
                "SHIFTX-RESEARCH-PROMOTION",
                `forbidden promotional field ${key}`,
            )
            rejectPromotionFields(child)
        }
    }
    rejectPromotionFields(report)
    strictKeys(report.candidate, ["id"], "SHIFTX-RESEARCH-REPORT")
    validateShiftxResearchAdmission(report.admission)
    requireGate(
        report.candidate.id === report.admission.candidateId,
        "SHIFTX-RESEARCH-REPORT",
        "candidate identity differs from admission",
    )

    strictKeys(
        report.baselineBuild,
        ["evidence", "identity"],
        "SHIFTX-RESEARCH-CONTROL-BUILD",
    )
    validateReference(
        report.baselineBuild.evidence,
        "SHIFTX-RESEARCH-CONTROL-BUILD",
    )
    strictKeys(
        report.baselineBuild.identity,
        [
            "gitSha",
            "runtimeTree",
            "tarballSha256",
            "productionEntrySha256",
            "distTreeSha256",
        ],
        "SHIFTX-RESEARCH-CONTROL-BUILD",
    )
    requireGate(
        report.baselineBuild.identity.gitSha === manifest.control.gitSha &&
            [report.baselineBuild.identity.runtimeTree].every(gitSha) &&
            [
                report.baselineBuild.identity.tarballSha256,
                report.baselineBuild.identity.productionEntrySha256,
                report.baselineBuild.identity.distTreeSha256,
            ].every(isSha256),
        "SHIFTX-RESEARCH-CONTROL-BUILD",
        "invalid beta.36 build identity",
    )

    strictKeys(
        report.applicationBuild,
        [
            "gitSha",
            "runtimeTree",
            "repositoryDirty",
            "command",
            "flags",
            "artifactSha256",
            "batchingFix",
            "cpuThrottle",
        ],
        "SHIFTX-RESEARCH-APPLICATION",
    )
    requireGate(
        gitSha(report.applicationBuild.gitSha) &&
            gitSha(report.applicationBuild.runtimeTree) &&
            report.applicationBuild.repositoryDirty === false &&
            nonempty(report.applicationBuild.command) &&
            Array.isArray(report.applicationBuild.flags) &&
            report.applicationBuild.flags.every(
                value => typeof value === "string",
            ) &&
            isSha256(report.applicationBuild.artifactSha256) &&
            report.applicationBuild.batchingFix === true &&
            finitePositive(report.applicationBuild.cpuThrottle),
        "SHIFTX-RESEARCH-APPLICATION",
        "invalid ShiftX application build identity",
    )
    strictKeys(
        report.browser,
        ["version", "binarySha256", "flags"],
        "SHIFTX-RESEARCH-BROWSER",
    )
    requireGate(
        nonempty(report.browser.version) &&
            isSha256(report.browser.binarySha256) &&
            Array.isArray(report.browser.flags) &&
            report.browser.flags.every(value => typeof value === "string"),
        "SHIFTX-RESEARCH-BROWSER",
        "invalid browser identity",
    )
    strictKeys(
        report.correctness,
        ["status", "smoke", "scenarios", "evidence"],
        "SHIFTX-RESEARCH-CORRECTNESS",
    )
    validateSmoke(report.correctness.smoke)
    requireGate(
        report.correctness.status === "pass" &&
            report.correctness.evidence === RAW_SHIFTX_EVIDENCE &&
            Array.isArray(report.correctness.scenarios),
        "SHIFTX-RESEARCH-CORRECTNESS",
        "validated public correctness is required",
    )
    for (const scenario of report.correctness.scenarios) {
        strictKeys(scenario, ["id", "checksum"], "SHIFTX-RESEARCH-CORRECTNESS")
        requireGate(
            nonempty(scenario.checksum),
            "SHIFTX-RESEARCH-CORRECTNESS",
            "missing checksum",
        )
    }
    exactRows(
        report.correctness.scenarios.map(row => row.id),
        manifest.shiftxWorkloads.map(row => row.id),
        "SHIFTX-RESEARCH-CORRECTNESS",
    )

    strictKeys(
        report.shiftx,
        ["status", "rows", "history", "profiles", "rawEvidence"],
        "SHIFTX-RESEARCH-RESULT",
    )
    requireGate(
        completed(report.shiftx.status) &&
            Array.isArray(report.shiftx.rows) &&
            Array.isArray(report.shiftx.history) &&
            report.shiftx.history.length > 0 &&
            Array.isArray(report.shiftx.profiles) &&
            report.shiftx.rawEvidence === RAW_SHIFTX_EVIDENCE,
        "SHIFTX-RESEARCH-RESULT",
        "invalid completed research outcome",
    )
    for (const row of report.shiftx.rows) validateShiftxRow(row)
    exactRows(
        report.shiftx.rows.map(row => row.id),
        manifest.shiftxWorkloads.map(row => row.id),
        "SHIFTX-RESEARCH-RESULT",
    )
    const expectedStatus = report.shiftx.rows.every(
        row => row.status === "pass",
    )
        ? "pass"
        : report.shiftx.rows.some(row => row.status === "fail")
          ? "fail"
          : "inconclusive"
    requireGate(
        report.shiftx.status === expectedStatus,
        "SHIFTX-RESEARCH-RESULT",
        "summary status differs from rows",
    )
    for (const round of report.shiftx.history) {
        strictKeys(
            round,
            ["pairs", "decisions", "tailPass"],
            "SHIFTX-RESEARCH-HISTORY",
        )
        requireGate(
            PAIR_LADDER.includes(round.pairs) &&
                Array.isArray(round.decisions) &&
                round.decisions.length === report.shiftx.rows.length &&
                typeof round.tailPass === "boolean",
            "SHIFTX-RESEARCH-HISTORY",
            "invalid paired decision history",
        )
        for (const decision of round.decisions)
            validateDecision(decision, round.pairs)
        exactRows(
            round.decisions.map(decision => decision.benchmark),
            manifest.shiftxWorkloads.map(row => row.id),
            "SHIFTX-RESEARCH-HISTORY",
        )
    }
    same(
        report.shiftx.history.map(round => round.pairs),
        PAIR_LADDER.slice(0, report.shiftx.history.length),
        "SHIFTX-RESEARCH-HISTORY",
        "decision rounds are not the bounded extension prefix",
    )
    requireGate(
        report.shiftx.rows.every(
            row => row.pairs === report.shiftx.history.at(-1).pairs,
        ),
        "SHIFTX-RESEARCH-HISTORY",
        "final decision round differs from result rows",
    )
    const finalDecisions = new Map(
        report.shiftx.history
            .at(-1)
            .decisions.map(decision => [decision.benchmark, decision]),
    )
    for (const row of report.shiftx.rows) {
        const decision = finalDecisions.get(row.id)
        const protectedStatus =
            decision.outcome === "within-budget"
                ? "pass"
                : decision.outcome === "regression"
                  ? "fail"
                  : "inconclusive"
        same(
            row.interval90,
            decision.intervalPct.map(value => 1 + value),
            "SHIFTX-RESEARCH-HISTORY",
            "row interval differs from final decision",
        )
        same(
            row.flags,
            decision.flags,
            "SHIFTX-RESEARCH-HISTORY",
            "row flags differ from final decision",
        )
        requireGate(
            Math.abs(row.estimateRatio / Math.exp(decision.estimateLn) - 1) <=
                1e-12 &&
                row.p95Ratio === row.candidateP95 / row.baselineP95 &&
                row.status ===
                    (row.p95Ratio > TAIL_RATIO_LIMIT
                        ? "fail"
                        : protectedStatus) &&
                row.decisions.protectedNonRegression.status ===
                    protectedStatus &&
                row.decisions.protectedNonRegression.pValue ===
                    decision.withinBudgetP &&
                row.decisions.protectedNonRegression.qValue ===
                    decision.withinBudgetQ,
            "SHIFTX-RESEARCH-HISTORY",
            "row differs from final decision",
        )
    }
    requireGate(
        report.shiftx.history.at(-1).tailPass ===
            report.shiftx.rows.every(row => row.p95Ratio <= TAIL_RATIO_LIMIT),
        "SHIFTX-RESEARCH-HISTORY",
        "final tail decision differs from p95 rows",
    )
    for (const profile of report.shiftx.profiles) validateProfile(profile)
    const profileKeys = report.shiftx.profiles.map(
        row => `${row.id}/${row.pairId}/${row.arm}`,
    )
    requireGate(
        new Set(profileKeys).size === profileKeys.length &&
            profileKeys.length ===
                report.shiftx.rows.reduce(
                    (sum, row) => sum + row.pairs * 2,
                    0,
                ) &&
            report.shiftx.rows.every(row =>
                Array.from({ length: row.pairs }, (_, pair) => pair).every(
                    pair =>
                        ["control", "candidate"].every(arm =>
                            profileKeys.includes(`${row.id}/${pair}/${arm}`),
                        ),
                ),
            ),
        "SHIFTX-RESEARCH-PROFILE",
        "profile inventory is incomplete or duplicated",
    )
    return report
}

function buildShiftxResearchReport({
    runId,
    admission,
    shiftx,
    plan,
    profiles,
    controlBuild,
}) {
    validateShiftxResearchAdmission(admission)
    const protectedResult = shiftx.results?.[PROTECTED_BASELINE]
    requireGate(
        protectedResult && completed(protectedResult.status),
        "SHIFTX-RESEARCH-RESULT",
        "beta.36 comparison is incomplete",
    )
    return validateShiftxResearchReport({
        schemaVersion: 1,
        kind: "shiftx-research",
        promotional: false,
        runId,
        candidate: { id: admission.candidateId },
        admission: structuredClone(admission),
        baselineBuild: {
            evidence: structuredClone(controlBuild.evidence),
            identity: artifactIdentity(controlBuild.metadata),
        },
        applicationBuild: {
            gitSha: plan.application.gitSha,
            runtimeTree: plan.application.runtimeTree,
            repositoryDirty: plan.application.repositoryDirty,
            command: plan.build.command,
            flags: [...plan.build.flags],
            artifactSha256: plan.build.artifactSha256,
            batchingFix: plan.build.batchingFix,
            cpuThrottle: plan.cpuThrottle,
        },
        browser: structuredClone(plan.browser),
        correctness: {
            status: "pass",
            smoke: structuredClone(admission.smoke),
            scenarios: plan.scenarios.map(({ id, checksum }) => ({
                id,
                checksum,
            })),
            evidence: RAW_SHIFTX_EVIDENCE,
        },
        shiftx: {
            status: protectedResult.status,
            rows: jsonClone(protectedResult.rows),
            history: jsonClone(protectedResult.history),
            profiles: structuredClone(profiles),
            rawEvidence: RAW_SHIFTX_EVIDENCE,
        },
    })
}

export async function runShiftxResearch(
    root,
    { runId, admission, candidateRoot, researchBaseGitSha, controlBuild },
) {
    validateShiftxResearchAdmission(admission)
    validateReplayIdentity(candidateRoot, admission, researchBaseGitSha)
    await validateRecordedContractC(admission)
    const builds = validateResearchInputs(root, admission, controlBuild)
    const shiftx = await validateShiftx(root, {
        candidateSha: admission.replay.gitSha,
        controlIdentity: artifactIdentity(builds.control),
        candidateIdentity: artifactIdentity(builds.candidate),
    })
    const freeze = json(evidencePath(root, "shiftx-freeze.json")),
        plan = json(evidencePath(root, freeze.plan)),
        profiles = readFileSync(evidencePath(root, RAW_SHIFTX_EVIDENCE), "utf8")
            .trimEnd()
            .split("\n")
            .map(line => JSON.parse(line))
            .filter(row => row.baselineId === PROTECTED_BASELINE)
            .map(row => ({
                id: row.id,
                pairId: row.pairId,
                arm: row.arm,
                process: row.process,
                processSha256: row.processSha256,
                trace: row.trace,
                traceSha256: row.traceSha256,
                profileTimelineSha256: row.profileTimelineSha256,
            }))
    requireGate(
        Date.parse(admission.execution.frozenAt) <= Date.parse(freeze.frozenAt),
        "SHIFTX-RESEARCH-ORDER",
        "candidate order was not frozen before ShiftX timing",
    )
    return buildShiftxResearchReport({
        runId,
        admission,
        shiftx,
        plan,
        profiles,
        controlBuild: {
            evidence: controlBuild,
            metadata: builds.control,
        },
    })
}
