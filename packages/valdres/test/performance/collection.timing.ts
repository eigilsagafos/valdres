/**
 * Seconds-scale collection timing smoke.
 *
 * The binding COL-008 performance gates are the deterministic counters and
 * traces in collection.performance.test.ts. This standalone Bun process only
 * catches a catastrophic constant-factor regression in Atom-only work after a
 * collection vtable is installed. It deliberately avoids bun:test (whose fake
 * timer origin can affect timing), fresh-process sampling, and host preflight.
 */
import { strict as assert } from "node:assert"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createCollectionDefinition } from "../../src/v1-internal/collection"
import { createCommittedStoreTreeDomain } from "../../src/v1-internal/committed-store-tree/committed-store-tree"

interface TimingPolicy {
    readonly primaryGate: "deterministic-structural"
    readonly timingRole: "advisory-smoke"
    readonly processCount: 1
    readonly rounds: number
    readonly warmupBatches: number
    readonly directIterationsPerBatch: number
    readonly transactionIterationsPerBatch: number
    readonly advisoryTargetRatio: number
    readonly catastrophicRatio: number
    readonly decisionMetric: "geometric-median-wall-ratio"
}

interface PerformancePolicy {
    readonly schemaVersion: 2
    readonly kind: "valdres-collection-performance-policy"
    readonly toolchain: { readonly runtime: "bun"; readonly version: string }
    readonly policy: TimingPolicy
}

const certification = JSON.parse(
    readFileSync(
        join(import.meta.dir, "collection-performance-certification.json"),
        "utf8",
    ),
) as PerformancePolicy
assert.equal(certification.schemaVersion, 2)
assert.equal(certification.kind, "valdres-collection-performance-policy")
assert.equal(certification.toolchain.runtime, "bun")
const timingPolicy = certification.policy
assert.equal(timingPolicy.primaryGate, "deterministic-structural")
assert.equal(timingPolicy.timingRole, "advisory-smoke")
assert.equal(timingPolicy.processCount, 1)
assert.equal(timingPolicy.decisionMetric, "geometric-median-wall-ratio")
for (const count of [
    timingPolicy.rounds,
    timingPolicy.warmupBatches,
    timingPolicy.directIterationsPerBatch,
    timingPolicy.transactionIterationsPerBatch,
])
    assert.ok(Number.isSafeInteger(count) && count > 0)
assert.ok(
    Number.isFinite(timingPolicy.advisoryTargetRatio) &&
        timingPolicy.advisoryTargetRatio > 1,
)
assert.ok(
    Number.isFinite(timingPolicy.catastrophicRatio) &&
        timingPolicy.catastrophicRatio > timingPolicy.advisoryTargetRatio,
)

const EXPECTED_BUN = certification.toolchain.version
const ROUNDS = timingPolicy.rounds
const WARMUP_BATCHES = timingPolicy.warmupBatches
const ADVISORY_TARGET_RATIO = timingPolicy.advisoryTargetRatio
const CATASTROPHIC_RATIO = timingPolicy.catastrophicRatio
const ITERATIONS_PER_BATCH = Object.freeze({
    "atom-direct": timingPolicy.directIterationsPerBatch,
    "atom-transaction": timingPolicy.transactionIterationsPerBatch,
})

type Scenario = "atom-direct" | "atom-transaction"
type Side = "control" | "installed"

interface BatchSample {
    readonly wallNsPerOperation: number
    readonly cpuNsPerOperation: number
}

interface SideSamples {
    readonly wallNsPerOperation: readonly number[]
    readonly cpuNsPerOperation: readonly number[]
}

interface ScenarioResult {
    readonly semanticChecksum: string
    readonly iterationsPerBatch: number
    readonly control: SideSamples
    readonly installed: SideSamples
    readonly pairedWallRatios: readonly number[]
    readonly pairedCpuRatios: readonly number[]
    readonly geometricMedianWallRatio: number
    readonly geometricMedianCpuRatio: number
    readonly decision: "within-advisory-target" | "advisory" | "catastrophic"
}

const median = (values: readonly number[]): number => {
    const sorted = [...values].sort((left, right) => left - right)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
        ? (sorted[middle - 1]! + sorted[middle]!) / 2
        : sorted[middle]!
}

const geometricMedian = (values: readonly number[]): number =>
    Math.exp(median(values.map(value => Math.log(value))))

const assertPositiveFinite = (value: number, label: string): void => {
    assert.ok(Number.isFinite(value) && value > 0, `${label} must be positive`)
}

const createFixture = (scenario: Scenario, side: Side) => {
    const domain = createCommittedStoreTreeDomain()
    if (side === "installed") createCollectionDefinition<number, number>(domain)
    const value = domain.atom(0)
    const semanticTarget = domain.createStoreTree()
    if (scenario === "atom-direct") semanticTarget.set(value, 2)
    else
        semanticTarget.txn(transaction => {
            transaction.set(value, 2)
        })
    const semanticValue = semanticTarget.get(value)
    semanticTarget.dispose()
    assert.equal(semanticValue, 2)
    const semanticChecksum = createHash("sha256")
        .update(`${scenario}:${semanticValue}`)
        .digest("hex")
    let executions = 0
    const operation =
        scenario === "atom-direct"
            ? () => {
                  const target = domain.createStoreTree()
                  target.set(value, ++executions)
                  target.dispose()
              }
            : () => {
                  const target = domain.createStoreTree()
                  target.txn(transaction =>
                      transaction.set(value, ++executions),
                  )
                  target.dispose()
              }
    return Object.freeze({
        operation,
        executions: () => executions,
        semanticChecksum,
    })
}

const measureBatch = (
    operation: () => void,
    iterations: number,
): BatchSample => {
    const cpuStart = process.cpuUsage()
    const wallStart = Bun.nanoseconds()
    for (let iteration = 0; iteration < iterations; iteration++) operation()
    const wallNs = Bun.nanoseconds() - wallStart
    const cpu = process.cpuUsage(cpuStart)
    const cpuNs = (cpu.user + cpu.system) * 1_000
    const sample = Object.freeze({
        wallNsPerOperation: wallNs / iterations,
        cpuNsPerOperation: cpuNs / iterations,
    })
    assertPositiveFinite(sample.wallNsPerOperation, "wall sample")
    assertPositiveFinite(sample.cpuNsPerOperation, "CPU sample")
    return sample
}

const measureScenario = (scenario: Scenario): ScenarioResult => {
    const control = createFixture(scenario, "control")
    const installed = createFixture(scenario, "installed")
    assert.equal(installed.semanticChecksum, control.semanticChecksum)

    // A small untimed primer lets JSC see both identical loop shapes before the
    // full-sized warmup. Every warm and measured side then uses one fixed count.
    for (let iteration = 0; iteration < 256; iteration++) {
        control.operation()
        installed.operation()
    }
    const iterationsPerBatch = ITERATIONS_PER_BATCH[scenario]

    for (let warmup = 0; warmup < WARMUP_BATCHES; warmup++) {
        const order: readonly Side[] =
            warmup % 2 === 0
                ? (["control", "installed"] as const)
                : (["installed", "control"] as const)
        for (const side of order) {
            Bun.gc(true)
            const fixture = side === "control" ? control : installed
            measureBatch(fixture.operation, iterationsPerBatch)
        }
    }

    const bySide: Record<Side, BatchSample[]> = {
        control: [],
        installed: [],
    }
    for (let round = 0; round < ROUNDS; round++) {
        const order: readonly Side[] =
            round % 2 === 0
                ? (["control", "installed"] as const)
                : (["installed", "control"] as const)
        for (const side of order) {
            Bun.gc(true)
            const fixture = side === "control" ? control : installed
            bySide[side].push(
                measureBatch(fixture.operation, iterationsPerBatch),
            )
        }
    }

    const expectedExecutions =
        256 + (WARMUP_BATCHES + ROUNDS) * iterationsPerBatch
    assert.equal(control.executions(), expectedExecutions)
    assert.equal(installed.executions(), expectedExecutions)
    assert.equal(bySide.control.length, ROUNDS)
    assert.equal(bySide.installed.length, ROUNDS)

    const controlWall = bySide.control.map(sample => sample.wallNsPerOperation)
    const installedWall = bySide.installed.map(
        sample => sample.wallNsPerOperation,
    )
    const controlCpu = bySide.control.map(sample => sample.cpuNsPerOperation)
    const installedCpu = bySide.installed.map(
        sample => sample.cpuNsPerOperation,
    )
    const pairedWallRatios = installedWall.map(
        (value, index) => value / controlWall[index]!,
    )
    const pairedCpuRatios = installedCpu.map(
        (value, index) => value / controlCpu[index]!,
    )
    for (const [index, ratio] of pairedWallRatios.entries())
        assertPositiveFinite(ratio, `wall ratio ${index}`)
    for (const [index, ratio] of pairedCpuRatios.entries())
        assertPositiveFinite(ratio, `CPU ratio ${index}`)

    const geometricMedianWallRatio = geometricMedian(pairedWallRatios)
    const geometricMedianCpuRatio = geometricMedian(pairedCpuRatios)
    const decision =
        geometricMedianWallRatio >= CATASTROPHIC_RATIO
            ? "catastrophic"
            : geometricMedianWallRatio <= ADVISORY_TARGET_RATIO
              ? "within-advisory-target"
              : "advisory"
    return Object.freeze({
        semanticChecksum: control.semanticChecksum,
        iterationsPerBatch,
        control: Object.freeze({
            wallNsPerOperation: Object.freeze(controlWall),
            cpuNsPerOperation: Object.freeze(controlCpu),
        }),
        installed: Object.freeze({
            wallNsPerOperation: Object.freeze(installedWall),
            cpuNsPerOperation: Object.freeze(installedCpu),
        }),
        pairedWallRatios: Object.freeze(pairedWallRatios),
        pairedCpuRatios: Object.freeze(pairedCpuRatios),
        geometricMedianWallRatio,
        geometricMedianCpuRatio,
        decision,
    })
}

assert.equal(
    Bun.version,
    EXPECTED_BUN,
    `timing smoke requires Bun ${EXPECTED_BUN}`,
)
const started = Bun.nanoseconds()
const scenarios = Object.freeze({
    atomDirect: measureScenario("atom-direct"),
    atomTransaction: measureScenario("atom-transaction"),
})
const elapsedMilliseconds = (Bun.nanoseconds() - started) / 1e6

const result = Object.freeze({
    schemaVersion: 2,
    kind: "valdres-collection-timing-smoke",
    toolchain: Object.freeze({ runtime: "bun", version: Bun.version }),
    policy: Object.freeze(timingPolicy),
    scenarios,
    elapsedMilliseconds,
})

console.log(JSON.stringify(result))

for (const [scenario, evidence] of Object.entries(scenarios)) {
    assert.notEqual(
        evidence.decision,
        "catastrophic",
        `${scenario} installed/control wall ratio ${evidence.geometricMedianWallRatio.toFixed(3)} reached the ${CATASTROPHIC_RATIO.toFixed(2)} catastrophic threshold`,
    )
}
