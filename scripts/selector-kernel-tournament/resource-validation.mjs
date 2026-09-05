import { manifest, requireGate, exactRows } from "./inputs.mjs"
import { strictKeys, same } from "./evidence.mjs"
import { ordinaryMedian } from "../lib/paired-decision-tournament.ts"
export function memoryProcessSummary(sample) {
    strictKeys(
        sample,
        [
            "schemaVersion",
            "kind",
            "id",
            "runtime",
            "pid",
            "unitCount",
            "samples",
            "samplerCalibration",
        ],
        "MEMORY-SCHEMA",
    )
    strictKeys(
        sample.samplerCalibration,
        ["kind", "publicOperations", "samples"],
        "MEMORY-CALIBRATION",
    )
    requireGate(
        sample.samplerCalibration.kind === "empty-sampler" &&
            sample.samplerCalibration.publicOperations === 0 &&
            sample.samplerCalibration.samples.length === 3,
        "MEMORY-CALIBRATION",
        "missing empty sampler calibration",
    )
    for (const row of sample.samplerCalibration.samples) {
        strictKeys(
            row,
            ["before", "retainedHeap", "releasedHeaps"],
            "MEMORY-CALIBRATION",
        )
        requireGate(
            Number.isSafeInteger(row.before) &&
                row.before >= 0 &&
                Number.isSafeInteger(row.retainedHeap) &&
                row.retainedHeap >= 0 &&
                Array.isArray(row.releasedHeaps) &&
                row.releasedHeaps.length === 3 &&
                row.releasedHeaps.every(n => Number.isSafeInteger(n) && n >= 0),
            "MEMORY-CALIBRATION",
            "missing raw sampler observations",
        )
    }
    const scenario = manifest.memoryScenarios.find(s => s.id === sample.id)
    requireGate(
        sample.schemaVersion === 2 &&
            sample.kind === "memory-process" &&
            scenario?.runtimes.includes(sample.runtime) &&
            sample.unitCount === scenario.units,
        "MEMORY-ID",
        "unknown scenario, runtime, or units",
    )
    requireGate(
        sample.samples.length === 3,
        "MEMORY-SAMPLES",
        "existing three-sample process protocol required",
    )
    for (const row of sample.samples) {
        strictKeys(
            row,
            ["before", "retainedHeap", "releasedHeaps"],
            "MEMORY-SCHEMA",
        )
        requireGate(
            Number.isSafeInteger(row.before) &&
                row.before >= 0 &&
                Number.isSafeInteger(row.retainedHeap) &&
                row.retainedHeap >= 0 &&
                Array.isArray(row.releasedHeaps) &&
                row.releasedHeaps.length === 3 &&
                row.releasedHeaps.every(n => Number.isSafeInteger(n) && n >= 0),
            "MEMORY-SAMPLES",
            "missing raw heaps or drains",
        )
    }
    // One process is one observation. Preserve the frozen memory harness's
    // median across its three independent samples at EACH release drain, just
    // as for retained and released byte ceilings. Do not turn one JIT/GC
    // subsample into an extra process-level observation.
    const releasedResidualByDrain = [0, 1, 2].map(drain =>
        ordinaryMedian(
            sample.samples.map(row =>
                Math.max(0, row.releasedHeaps[drain] - row.before),
            ),
        ),
    )
    requireGate(
        !(
            releasedResidualByDrain[0] < releasedResidualByDrain[1] &&
            releasedResidualByDrain[1] < releasedResidualByDrain[2]
        ),
        "MEMORY-MONOTONIC-LEAK",
        sample.id,
    )
    const retainedBytes = ordinaryMedian(
            sample.samples.map(s => Math.max(0, s.retainedHeap - s.before)),
        ),
        releasedResidualBytes = ordinaryMedian(
            sample.samples.map(s =>
                Math.max(0, s.releasedHeaps.at(-1) - s.before),
            ),
        ),
        retainedBytesPerUnit = retainedBytes / scenario.units,
        ceiling = scenario.absoluteCeilings[sample.runtime]
    return {
        retainedBytes,
        retainedBytesPerUnit,
        releasedResidualBytes,
        releasedResidualByDrain,
        absolutePass:
            retainedBytesPerUnit <= ceiling.retainedBytesPerUnit &&
            releasedResidualBytes <= ceiling.releasedResidualBytes,
    }
}
export function assertMemoryAbsolute(sample) {
    const summary = memoryProcessSummary(sample)
    requireGate(
        summary.absolutePass,
        "MEMORY-ABSOLUTE",
        `${sample.id}/${sample.runtime}: retained ${summary.retainedBytesPerUnit} B/unit; released ${summary.releasedResidualBytes} B`,
    )
    return summary
}
export function decideMemory(records) {
    const byLane = new Map()
    for (const record of records) {
        strictKeys(
            record,
            [
                "id",
                "runtime",
                "pairId",
                "arm",
                "sample",
                "process",
                "processSha256",
            ],
            "MEMORY-RECORD-SCHEMA",
        )
        requireGate(
            ["control", "candidate"].includes(record.arm),
            "MEMORY-ARM",
            "unknown arm",
        )
        requireGate(
            record.id === record.sample.id &&
                record.runtime === record.sample.runtime,
            "MEMORY-ID",
            "record identity",
        )
        const summary = memoryProcessSummary(record.sample),
            key = record.id + "/" + record.runtime
        if (!byLane.has(key)) byLane.set(key, [])
        byLane.get(key).push({ ...record, summary })
    }
    exactRows(
        [...byLane.keys()],
        manifest.memoryScenarios.flatMap(s =>
            s.runtimes.map(r => s.id + "/" + r),
        ),
        "MEMORY-INVENTORY",
    )
    const rows = []
    for (const [key, samples] of byLane) {
        requireGate(samples.length === 10, "MEMORY-PAIRS", key)
        for (let pair = 0; pair < 5; pair++) {
            const arms = samples.slice(pair * 2, pair * 2 + 2)
            same(
                arms.map(a => a.arm),
                manifest.stages.A.timingOrder[pair % 2],
                "MEMORY-ORDER",
                key,
            )
            requireGate(
                arms.every(a => a.pairId === String(pair)),
                "MEMORY-PAIRS",
                key,
            )
        }
        const [id, runtime] = key.split("/"),
            scenario = manifest.memoryScenarios.find(s => s.id === id),
            control = samples.filter(s => s.arm === "control"),
            candidate = samples.filter(s => s.arm === "candidate")
        const base = ordinaryMedian(
                control.map(s => s.summary.retainedBytesPerUnit),
            ),
            head = ordinaryMedian(
                candidate.map(s => s.summary.retainedBytesPerUnit),
            )
        requireGate(base > 0 || head === 0, "MEMORY-ZERO-BASELINE", key)
        const ratio = base === 0 ? 1 : head / base,
            ceiling = scenario.absoluteCeilings[runtime]
        rows.push({
            id,
            runtime,
            status:
                samples.every(s => s.summary.absolutePass) && ratio <= 1.1
                    ? "pass"
                    : "fail",
            pairs: 5,
            unitCount: scenario.units,
            controlMedianRetainedBytesPerUnit: base,
            candidateMedianRetainedBytesPerUnit: head,
            retainedRatio: ratio,
            controlMedianReleasedResidualBytes: ordinaryMedian(
                control.map(s => s.summary.releasedResidualBytes),
            ),
            candidateMedianReleasedResidualBytes: ordinaryMedian(
                candidate.map(s => s.summary.releasedResidualBytes),
            ),
            retainedBytesPerUnitCeiling: ceiling.retainedBytesPerUnit,
            releasedResidualBytesCeiling: ceiling.releasedResidualBytes,
            rawEvidence: "memory.ndjson",
        })
    }
    return rows
}
export function decideSizes(control, candidate, baseline) {
    const metricKeys = value =>
        Object.entries(value).flatMap(([id, metrics]) =>
            Object.keys(metrics).map(unit => id + "/" + unit),
        )
    exactRows(metricKeys(candidate), metricKeys(control), "SIZE-METRICS")
    exactRows(metricKeys(control), metricKeys(baseline), "SIZE-METRICS")
    const rows = []
    for (const [id, metrics] of Object.entries(control))
        for (const unit of ["raw", "gzip"]) {
            const controlBytes = metrics[unit],
                candidateBytes = candidate[id][unit]
            requireGate(
                Number.isSafeInteger(controlBytes) &&
                    controlBytes > 0 &&
                    Number.isSafeInteger(candidateBytes) &&
                    candidateBytes >= 0,
                "SIZE-METRICS",
                id,
            )
            const ratio = candidateBytes / controlBytes
            rows.push({
                id,
                unit,
                status:
                    candidateBytes <= Math.ceil(controlBytes * 1.02) &&
                    controlBytes <= Math.ceil(baseline[id][unit] * 1.02)
                        ? "pass"
                        : "fail",
                controlBytes,
                candidateBytes,
                ratio,
                budgetRatio: 1.02,
                rawEvidence: "sizes.json",
            })
        }
    return rows
}
