import { join } from "node:path"
import { readFileSync } from "node:fs"
import {
    ROOT,
    manifest,
    json,
    fileHash,
    sha256,
    requireGate,
    exactRows,
    verifyClaimIdentity,
    git,
} from "./inputs.mjs"
import { strictKeys, same, evidencePath } from "./evidence.mjs"
import { validateProcess } from "./process-evidence.mjs"
import {
    DEFAULT_PAIRED_POLICY,
    decidePairedRun,
} from "../lib/paired-decision.ts"
import {
    ordinaryMedian,
    nearestRank,
} from "../lib/paired-decision-tournament.ts"
import { extractPackedArtifact } from "../../packages/valdres/test/performance/core-load/artifact.mjs"
// Preserve signed Chrome deltas in event order, from Profile.startTime. Never
// substitute chunk counts, sample counts, or absolute delta magnitudes for time.
export function profileTimeline(trace) {
    requireGate(
        trace && Array.isArray(trace.traceEvents),
        "SHIFTX-TRACE",
        "missing Chrome traceEvents",
    )
    const profiles = new Map()
    for (const event of trace.traceEvents) {
        if (!["Profile", "ProfileChunk"].includes(event.name)) continue
        const key = String(event.id) + "/" + event.pid + "/" + event.tid,
            data = event.args?.data
        requireGate(
            data && typeof data === "object",
            "SHIFTX-PROFILE",
            "missing profile data",
        )
        if (event.name === "Profile") {
            requireGate(
                Number.isFinite(data.startTime) && !profiles.has(key),
                "SHIFTX-PROFILE",
                "missing or duplicate Profile.startTime",
            )
            profiles.set(key, {
                startTime: data.startTime,
                cursor: data.startTime,
                samples: [],
                nodes: new Set(),
            })
            continue
        }
        const profile = profiles.get(key)
        requireGate(profile, "SHIFTX-PROFILE", "chunk precedes Profile")
        for (const node of data.cpuProfile?.nodes ?? [])
            profile.nodes.add(node.id)
        const samples = data.cpuProfile?.samples ?? [],
            deltas = data.timeDeltas
        requireGate(
            Array.isArray(samples) &&
                Array.isArray(deltas) &&
                samples.length === deltas.length,
            "SHIFTX-PROFILE",
            "incomplete timeDeltas",
        )
        for (let i = 0; i < samples.length; i++) {
            requireGate(
                Number.isFinite(deltas[i]) && Number.isInteger(samples[i]),
                "SHIFTX-PROFILE",
                "invalid sample or signed delta",
            )
            profile.cursor += deltas[i]
            profile.samples.push({
                node: samples[i],
                delta: deltas[i],
                at: profile.cursor,
            })
        }
    }
    requireGate(profiles.size > 0, "SHIFTX-PROFILE", "no Profile evidence")
    return [...profiles.entries()].map(([id, p]) => {
        requireGate(
            p.samples.length > 0 && p.samples.every(s => p.nodes.has(s.node)),
            "SHIFTX-PROFILE",
            "missing sampled node",
        )
        return { id, startTime: p.startTime, samples: p.samples }
    })
}
export function interactionDuration(trace, scenario) {
    const events = trace.traceEvents,
        starts = events.filter(e => e.name === scenario.startMarker),
        steps = events.filter(e => e.name === scenario.stepMarker)
    requireGate(
        starts.length === 1 && steps.length === scenario.expectedSteps,
        "SHIFTX-INTERACTION",
        "missing start or fixed gesture steps",
    )
    const start = starts[0],
        last = steps.at(-1)
    requireGate(
        Number.isFinite(start.ts) &&
            steps.every(
                e =>
                    Number.isFinite(e.ts) &&
                    e.pid === start.pid &&
                    e.tid === start.tid,
            ) &&
            last.ts >= start.ts,
        "SHIFTX-INTERACTION",
        "wrong interaction thread or clock",
    )
    const tasks = events.filter(
        e =>
            e.name === "RunTask" &&
            e.pid === start.pid &&
            e.tid === start.tid &&
            Number.isFinite(e.ts) &&
            Number.isFinite(e.dur) &&
            e.ts <= last.ts &&
            e.ts + e.dur >= last.ts,
    )
    requireGate(
        tasks.length === 1,
        "SHIFTX-INTERACTION",
        "end must be one containing RunTask",
    )
    const durationNs = (tasks[0].ts + tasks[0].dur - start.ts) * 1000
    requireGate(durationNs > 0, "SHIFTX-INTERACTION", "nonpositive interval")
    return durationNs
}
export function decideShiftx(lanes, baselineId) {
    requireGate(
        ["beta36-control", "pre28-claim"].includes(baselineId),
        "SHIFTX-BASELINE",
        "unknown baseline",
    )
    exactRows(
        lanes.map(l => l.id),
        manifest.shiftxWorkloads.map(l => l.id),
        "SHIFTX-INVENTORY",
    )
    const n = lanes[0].samples.length
    requireGate(
        [8, 12, 16, 20].includes(n) && lanes.every(l => l.samples.length === n),
        "SHIFTX-PAIRS",
        "unbalanced or incomplete fixed round",
    )
    const decide = count =>
        decidePairedRun(
            lanes.map(l => ({
                benchmark: l.id,
                runtime: "chrome",
                suite: "selector-kernel-shiftx",
                family: "protected",
                samples: l.samples.slice(0, count),
            })),
            { ...DEFAULT_PAIRED_POLICY, minPairs: 8, budgetPct: 0.1 },
        )
    const history = []
    for (let count = 8; count <= n; count += 4) {
        const decisions = decide(count),
            tailPass = lanes.every(
                l =>
                    nearestRank(
                        l.samples.slice(0, count).map(s => s.headNs),
                        0.95,
                    ) /
                        nearestRank(
                            l.samples.slice(0, count).map(s => s.baseNs),
                            0.95,
                        ) <=
                    1.2,
            )
        history.push({ pairs: count, decisions, tailPass })
        if (count < n)
            requireGate(
                tailPass &&
                    !decisions.some(d => d.outcome === "regression") &&
                    decisions.some(d => d.outcome === "inconclusive"),
                "SHIFTX-SELECTIVE-EXTENSION",
                "extension is allowed only after an inconclusive protected round",
            )
    }
    const decisions = history.at(-1).decisions,
        rows = lanes.map((lane, i) => {
            const d = decisions[i],
                base = lane.samples.map(s => s.baseNs),
                head = lane.samples.map(s => s.headNs),
                estimateRatio = Math.exp(d.estimateLn),
                interval90 = d.intervalPct.map(p => 1 + p),
                p95Ratio = nearestRank(head, 0.95) / nearestRank(base, 0.95),
                protection =
                    d.outcome === "within-budget"
                        ? "pass"
                        : d.outcome === "regression"
                          ? "fail"
                          : "inconclusive",
                claim =
                    estimateRatio < 1 && interval90[1] < 1
                        ? "pass"
                        : "inconclusive"
            return {
                id: lane.id,
                runtime: "chrome",
                baselineId,
                protected: baselineId === "beta36-control",
                intended: false,
                status:
                    baselineId === "pre28-claim"
                        ? claim
                        : p95Ratio > 1.2
                          ? "fail"
                          : protection,
                pairs: n,
                baselineP50: ordinaryMedian(base),
                candidateP50: ordinaryMedian(head),
                baselineP95: nearestRank(base, 0.95),
                candidateP95: nearestRank(head, 0.95),
                p95Ratio,
                estimateRatio,
                interval90,
                decisions: {
                    protectedNonRegression:
                        baselineId === "beta36-control"
                            ? {
                                  nullRatio: 1.1,
                                  alternative: "less",
                                  pValue: d.withinBudgetP,
                                  qValue: d.withinBudgetQ,
                                  status: protection,
                              }
                            : null,
                    intendedWin: null,
                    pre28Claim:
                        baselineId === "pre28-claim"
                            ? {
                                  estimateMaximum: 1,
                                  intervalUpperExclusive: 1,
                                  status: claim,
                              }
                            : null,
                },
                flags: d.flags,
                rawEvidence: "shiftx-timings.ndjson",
            }
        })
    return {
        rows,
        history,
        status: rows.every(r => r.status === "pass")
            ? "pass"
            : rows.some(r => r.status === "fail")
              ? "fail"
              : "inconclusive",
    }
}
export async function validateShiftx(
    root,
    { candidateSha, controlIdentity, candidateIdentity },
) {
    const freeze = json(evidencePath(root, "shiftx-freeze.json"))
    strictKeys(
        freeze,
        ["schemaVersion", "plan", "sha256", "frozenAt"],
        "SHIFTX-FREEZE",
    )
    requireGate(
        freeze.schemaVersion === 3 &&
            fileHash(evidencePath(root, freeze.plan)) === freeze.sha256 &&
            Number.isFinite(Date.parse(freeze.frozenAt)),
        "SHIFTX-FREEZE",
        "external plan changed",
    )
    const plan = json(evidencePath(root, freeze.plan))
    strictKeys(
        plan,
        [
            "application",
            "browser",
            "build",
            "cpuThrottle",
            "fixtures",
            "interactionScript",
            "parserSha256",
            "scenarios",
            "commands",
        ],
        "SHIFTX-PLAN",
    )
    strictKeys(
        plan.application,
        ["gitSha", "runtimeTree", "repositoryDirty"],
        "SHIFTX-PLAN",
    )
    requireGate(
        /^[a-f0-9]{40}$/.test(plan.application.gitSha) &&
            /^[a-f0-9]{40}$/.test(plan.application.runtimeTree) &&
            plan.application.repositoryDirty === false,
        "SHIFTX-APPLICATION",
        "missing clean application revision",
    )
    strictKeys(
        plan.browser,
        ["version", "binarySha256", "flags"],
        "SHIFTX-PLAN",
    )
    requireGate(
        typeof plan.browser.version === "string" &&
            /^[a-f0-9]{64}$/.test(plan.browser.binarySha256) &&
            Array.isArray(plan.browser.flags),
        "SHIFTX-BROWSER",
        "browser not frozen",
    )
    strictKeys(
        plan.build,
        ["command", "flags", "artifactSha256", "batchingFix"],
        "SHIFTX-PLAN",
    )
    requireGate(
        plan.build.batchingFix === true &&
            typeof plan.build.command === "string" &&
            Array.isArray(plan.build.flags) &&
            /^[a-f0-9]{64}$/.test(plan.build.artifactSha256) &&
            Number.isFinite(plan.cpuThrottle) &&
            plan.cpuThrottle > 0,
        "SHIFTX-BUILD",
        "missing production build or throttle",
    )
    requireGate(
        plan.parserSha256 ===
            fileHash(
                join(ROOT, "scripts/selector-kernel-tournament/shiftx.mjs"),
            ),
        "SHIFTX-PARSER-HASH",
        "parser differs from foundation",
    )
    for (const item of [...plan.fixtures, plan.interactionScript]) {
        strictKeys(item, ["path", "sha256"], "SHIFTX-PLAN")
        requireGate(
            fileHash(evidencePath(root, item.path)) === item.sha256,
            "SHIFTX-FIXTURE-HASH",
            item.path,
        )
    }
    exactRows(
        plan.scenarios.map(s => s.id),
        manifest.shiftxWorkloads.map(s => s.id),
        "SHIFTX-INVENTORY",
    )
    for (const scenario of plan.scenarios) {
        strictKeys(
            scenario,
            ["id", "startMarker", "stepMarker", "expectedSteps", "checksum"],
            "SHIFTX-PLAN",
        )
        const manifestRow = manifest.shiftxWorkloads.find(
            s => s.id === scenario.id,
        )
        requireGate(
            scenario.expectedSteps ===
                (manifestRow.id === "X-SINGLE-DECISION-DROP" ? 1 : 15) &&
                typeof scenario.startMarker === "string" &&
                typeof scenario.stepMarker === "string" &&
                typeof scenario.checksum === "string" &&
                scenario.checksum.length > 0,
            "SHIFTX-INTERACTION",
            "unfrozen gesture or checksum",
        )
    }
    strictKeys(plan.commands, ["control", "candidate", "pre28"], "SHIFTX-PLAN")
    for (const argv of Object.values(plan.commands))
        requireGate(
            Array.isArray(argv) &&
                argv.length > 0 &&
                argv.every(s => typeof s === "string"),
            "SHIFTX-INVOCATION",
            "missing command",
        )
    const records = readFileSync(
            evidencePath(root, "shiftx-timings.ndjson"),
            "utf8",
        )
            .trimEnd()
            .split("\n")
            .map(JSON.parse),
        byBaseline = new Map(),
        seen = new Set()
    let endedAt = ""
    for (const row of records) {
        strictKeys(
            row,
            [
                "id",
                "baselineId",
                "pairId",
                "arm",
                "process",
                "processSha256",
                "trace",
                "traceSha256",
                "planSha256",
                "durationNs",
                "profileTimelineSha256",
            ],
            "SHIFTX-RECORD",
        )
        requireGate(
            ["beta36-control", "pre28-claim"].includes(row.baselineId) &&
                ["control", "candidate"].includes(row.arm) &&
                plan.scenarios.some(s => s.id === row.id),
            "SHIFTX-ID",
            "unknown lane or arm",
        )
        requireGate(!seen.has(row.process), "SHIFTX-PROCESS", "process reused")
        seen.add(row.process)
        requireGate(
            fileHash(evidencePath(root, row.process)) === row.processSha256 &&
                fileHash(evidencePath(root, row.trace)) === row.traceSha256 &&
                row.planSha256 === freeze.sha256,
            "SHIFTX-PROVENANCE",
            "process, trace or plan changed",
        )
        const process = json(evidencePath(root, row.process)),
            commandKey =
                row.arm === "candidate"
                    ? "candidate"
                    : row.baselineId === "pre28-claim"
                      ? "pre28"
                      : "control"
        validateProcess(process, {
            argv: [...plan.commands[commandKey], row.id, row.pairId],
        })
        requireGate(
            Date.parse(process.startedAt) >= Date.parse(freeze.frozenAt) &&
                (!endedAt ||
                    Date.parse(process.startedAt) >= Date.parse(endedAt)),
            "SHIFTX-ORDER",
            "overlapping processes or measurement before freeze",
        )
        endedAt = process.endedAt
        const sample = JSON.parse(process.stdout)
        strictKeys(
            sample,
            [
                "pid",
                "browser",
                "applicationGitSha",
                "buildArtifactSha256",
                "cpuThrottle",
                "checksum",
                "consoleErrors",
                "publicErrors",
                "entrySha256",
                "traceSha256",
            ],
            "SHIFTX-SAMPLE",
        )
        const scenario = plan.scenarios.find(s => s.id === row.id)
        requireGate(
            sample.pid === process.pid &&
                sample.browser === plan.browser.version &&
                sample.applicationGitSha === plan.application.gitSha &&
                sample.buildArtifactSha256 === plan.build.artifactSha256 &&
                sample.cpuThrottle === plan.cpuThrottle &&
                sample.checksum === scenario.checksum &&
                Array.isArray(sample.consoleErrors) &&
                sample.consoleErrors.length === 0 &&
                Array.isArray(sample.publicErrors) &&
                sample.publicErrors.length === 0 &&
                sample.traceSha256 === row.traceSha256,
            "SHIFTX-SEMANTICS",
            "wrong public result, errors, or runtime provenance",
        )
        const identity =
            row.arm === "candidate"
                ? candidateIdentity
                : row.baselineId === "beta36-control"
                  ? controlIdentity
                  : json(evidencePath(root, "pre28-identity.json"))
        requireGate(
            sample.entrySha256 === identity.productionEntrySha256,
            "SHIFTX-ENTRY-HASH",
            "wrong package loaded",
        )
        const trace = json(evidencePath(root, row.trace))
        requireGate(
            interactionDuration(trace, scenario) === row.durationNs &&
                sha256(JSON.stringify(profileTimeline(trace))) ===
                    row.profileTimelineSha256,
            "SHIFTX-TRACE-RESULT",
            "summary differs from signed raw trace",
        )
        if (!byBaseline.has(row.baselineId)) byBaseline.set(row.baselineId, [])
        byBaseline.get(row.baselineId).push(row)
    }
    for (let i = 0; i < records.length; i += 2) {
        const pair = records.slice(i, i + 2)
        requireGate(
            pair.length === 2 &&
                pair[0].baselineId === pair[1].baselineId &&
                pair[0].id === pair[1].id &&
                pair[0].pairId === pair[1].pairId,
            "SHIFTX-ORDER",
            "another lane ran between pair arms",
        )
        same(
            pair.map(r => r.arm),
            manifest.stages.A.timingOrder[Number(pair[0].pairId) % 2],
            "SHIFTX-ORDER",
            "pair order",
        )
    }
    const firstClaim = records.findIndex(r => r.baselineId === "pre28-claim")
    requireGate(
        firstClaim < 0 ||
            records
                .slice(firstClaim)
                .every(r => r.baselineId === "pre28-claim"),
        "SHIFTX-PRE28-AUTH",
        "claim started before beta.36 comparison completed",
    )
    requireGate(
        byBaseline.has("beta36-control"),
        "SHIFTX-ORDER",
        "beta.36 must qualify first",
    )
    let pre28Claim = null
    const results = {}
    for (const [baselineId, observations] of byBaseline) {
        if (baselineId === "pre28-claim") {
            requireGate(
                results["beta36-control"]?.status === "pass",
                "SHIFTX-PRE28-AUTH",
                "beta.36 gate did not pass",
            )
            const identity = json(evidencePath(root, "pre28-identity.json"))
            verifyClaimIdentity(identity, evidencePath(root, "pre28.tgz"))
            const packed = extractPackedArtifact(
                evidencePath(root, "pre28.tgz"),
            )
            try {
                requireGate(
                    packed.entrySha256 === identity.productionEntrySha256 &&
                        packed.distTreeSha256 === identity.distTreeSha256,
                    "INPUT-PRE28-IDENTITY",
                    "packed entry differs",
                )
            } finally {
                packed.cleanup()
            }
            pre28Claim = identity
        }
        const lanes = plan.scenarios.map(s => {
            const rows = observations.filter(r => r.id === s.id)
            requireGate(
                rows.length % 2 === 0,
                "SHIFTX-PAIRS",
                "unpaired observation",
            )
            const samples = []
            for (let pair = 0; pair < rows.length / 2; pair++) {
                const pairRows = rows.slice(pair * 2, pair * 2 + 2)
                same(
                    pairRows.map(r => r.arm),
                    manifest.stages.A.timingOrder[pair % 2],
                    "SHIFTX-ORDER",
                    "unbalanced pair order",
                )
                requireGate(
                    pairRows.every(r => r.pairId === String(pair)),
                    "SHIFTX-PAIRS",
                    "missing pair",
                )
                samples.push({
                    pairId: String(pair),
                    baseNs: pairRows.find(r => r.arm === "control").durationNs,
                    headNs: pairRows.find(r => r.arm === "candidate")
                        .durationNs,
                })
            }
            return { id: s.id, samples }
        })
        results[baselineId] = decideShiftx(lanes, baselineId)
    }
    return {
        status: results["beta36-control"].status,
        rows: Object.values(results).flatMap(r => r.rows),
        results,
        pre28Claim,
        browser: plan.browser.version,
    }
}
