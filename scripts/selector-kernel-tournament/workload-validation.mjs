import { requireGate } from "./gate.mjs"
const commonNames = [
    "selectorBodyEntries",
    "suppliedGets",
    "serveCalls",
    "proposalsReturned",
    "proposalsInstalled",
    "dependencyEdgesAdded",
    "dependencyEdgesRemoved",
    "notifications",
    "subscriberCallbacks",
    "publicOperations",
    "checksum",
    "retainedHeapBytes",
]
function keys(value, names, id) {
    requireGate(
        value && typeof value === "object" && !Array.isArray(value),
        id,
        "expected object",
    )
    requireGate(
        JSON.stringify(Object.keys(value).sort()) ===
            JSON.stringify([...names].sort()),
        id,
        "unknown or missing field",
    )
}
export function validateWorkloadExpectations(value, manifest) {
    keys(
        value,
        ["schemaVersion", "tournamentId", "rows"],
        "WORKLOAD-EXPECTATIONS",
    )
    requireGate(
        value.schemaVersion === 2 && value.tournamentId === manifest.id,
        "WORKLOAD-EXPECTATIONS",
        "version",
    )
    requireGate(
        value.rows.length === manifest.performanceWorkloads.length,
        "WORKLOAD-EXPECTATIONS",
        "inventory count",
    )
    const seen = new Set()
    for (const row of value.rows) {
        keys(
            row,
            ["id", "timer", "counts", "checksum"],
            "WORKLOAD-EXPECTATIONS",
        )
        const frozen = manifest.performanceWorkloads.find(r => r.id === row.id)
        requireGate(
            frozen && !seen.has(row.id),
            "WORKLOAD-EXPECTATIONS",
            "unknown or duplicate ID",
        )
        seen.add(row.id)
        requireGate(row.timer === frozen.timer, "WORKLOAD-TIMER", "timer drift")
        requireGate(
            /^(?:[a-f0-9]{8}|[a-f0-9]{64})$/.test(row.checksum),
            "WORKLOAD-CHECKSUM",
            "invalid digest",
        )
        requireGate(
            Object.keys(row.counts).every(key =>
                [
                    "txn",
                    "set",
                    "get",
                    "sub",
                    "unsub",
                    "callback",
                    "subscriberCallbacks",
                    "consumed",
                    "batch",
                    "publicOperations",
                    "hydrationRead",
                    "renderReads",
                    "notificationReads",
                    "notifications",
                    "subscriptions",
                    "timedUnsubscriptions",
                    "totalUnsubscriptions",
                    "entityWrites",
                    "metaWrites",
                ].includes(key),
            ),
            "WORKLOAD-WORK-COUNT",
            "unknown count",
        )
        for (const count of Object.values(row.counts))
            requireGate(
                Number.isSafeInteger(count) && count >= 0,
                "WORKLOAD-WORK-COUNT",
                "invalid count",
            )
    }
}
export function validateWorkloadSample(
    sample,
    { row, runtime, mode, expected, entrySha256 },
) {
    keys(
        sample,
        [
            "schemaVersion",
            "kind",
            "runtime",
            "pid",
            "entrySha256",
            "id",
            "mode",
            "durationNs",
            "counts",
            "checksum",
            "common",
            "core",
        ],
        "WORKLOAD-SCHEMA",
    )
    requireGate(
        sample.schemaVersion === 2 &&
            sample.kind === "workload-process" &&
            sample.runtime === runtime &&
            sample.id === row.id &&
            row.runtimes.includes(runtime),
        "WORKLOAD-ID",
        "sample identity",
    )
    requireGate(
        sample.entrySha256 === entrySha256,
        "PROVENANCE-ENTRY-HASH",
        "runtime loaded a different entry",
    )
    requireGate(sample.mode === mode, "WORKLOAD-MODE", "artifact mode")
    requireGate(
        mode === "timed"
            ? Number.isFinite(sample.durationNs) &&
                  sample.durationNs >= (row.minimumAggregatedDurationNs ?? 1) &&
                  sample.common === null
            : sample.durationNs === null && sample.common !== null,
        "ARTIFACT-INSTRUMENTATION",
        "timed and counter evidence cannot mix",
    )
    requireGate(
        JSON.stringify(sample.counts) === JSON.stringify(expected.counts),
        "WORKLOAD-WORK-COUNT",
        row.id,
    )
    requireGate(
        sample.checksum === expected.checksum,
        "WORKLOAD-CHECKSUM",
        row.id,
    )
    if (sample.common) {
        keys(sample.common, commonNames, "COUNTER-SCHEMA")
        for (const key of commonNames.filter(k => k !== "checksum"))
            requireGate(
                Number.isSafeInteger(sample.common[key]) &&
                    sample.common[key] >= 0,
                "COUNTER-SCHEMA",
                key,
            )
        requireGate(
            sample.common.checksum === sample.checksum,
            "WORKLOAD-CHECKSUM",
            "counter checksum",
        )
    }
    requireGate(
        (row.group === "packed-core-load") === (sample.core !== null),
        "WORKLOAD-CORE",
        "missing or extra core evidence",
    )
    if (sample.core) {
        keys(
            sample.core,
            [
                "mode",
                "scenario",
                "elapsedMs",
                "semanticChecksum",
                "oracleTraceSha256",
                "selectedFinalValues",
                "counterReset",
                "work",
                "internalWork",
                "postDrain",
            ],
            "WORKLOAD-CORE",
        )
        requireGate(
            sample.core.semanticChecksum === expected.checksum &&
                JSON.stringify(sample.core.work) ===
                    JSON.stringify(expected.counts),
            "WORKLOAD-CORE",
            "frozen core output",
        )
    }
    return sample
}
