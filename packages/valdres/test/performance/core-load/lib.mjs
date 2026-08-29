import { createHash } from "node:crypto"
import { readFileSync, realpathSync } from "node:fs"
import { dirname, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

export const HARNESS_SCHEMA_VERSION = 1

const HERE = dirname(fileURLToPath(import.meta.url))
export const DEFAULT_FIXTURE_PATH = resolve(HERE, "fixture.v1.json")
export const ADAPTERS_PATH = resolve(HERE, "adapters")
export const AUTHORITATIVE_FIXTURE_SHA256 =
    "bc0e260b35d3deef4dbda8324d35e8eb409b7dd8625f2520ccda2c81aafb7c7a"
export const AUTHORITATIVE_DIGESTS = Object.freeze({
    writes: Object.freeze({
        semanticChecksum: "d83b21cc",
        oracleTraceSha256:
            "8b64a81ecd20431da979b58c909ca3945a1ad7b1dead8938f90bfb3a5359686c",
    }),
    "no-writes": Object.freeze({
        semanticChecksum: "d48af58b",
        oracleTraceSha256:
            "963afb5cee2e6fa5e414c1234504516689218532e0dc5e436cd2b86392a34ed2",
    }),
})

export function sha256Bytes(value) {
    return createHash("sha256").update(value).digest("hex")
}

export function sha256File(path) {
    return sha256Bytes(readFileSync(path))
}

export function median(values) {
    assertSamples(values)
    const sorted = [...values].sort((left, right) => left - right)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle]
}

export function nearestRank(values, percentile) {
    assertSamples(values)
    if (!(percentile > 0 && percentile <= 1)) {
        throw new Error(`percentile must be in (0, 1], received ${percentile}`)
    }
    const sorted = [...values].sort((left, right) => left - right)
    return sorted[Math.ceil(percentile * sorted.length) - 1]
}

function assertSamples(values) {
    if (
        !Array.isArray(values) ||
        values.length === 0 ||
        values.some(value => !Number.isFinite(value) || value <= 0)
    ) {
        throw new Error(
            "latency samples must be a non-empty array of positive finite numbers",
        )
    }
}

export function readFixture(path = DEFAULT_FIXTURE_PATH) {
    const fixture = JSON.parse(readFileSync(path, "utf8"))
    validateFixture(fixture, path)
    return fixture
}

export function authoritativeFixtureProblems(fixturePath, fixture) {
    const problems = []
    const canonicalPath = realpathSync(DEFAULT_FIXTURE_PATH)
    if (realpathSync(fixturePath) !== canonicalPath) {
        problems.push("fixture path is not the checked-in default fixture")
    }
    const fixtureSha256 = sha256File(fixturePath)
    if (fixtureSha256 !== AUTHORITATIVE_FIXTURE_SHA256) {
        problems.push(
            `fixture SHA-256 ${fixtureSha256} does not match frozen ${AUTHORITATIVE_FIXTURE_SHA256}`,
        )
    }
    for (const scenario of ["writes", "no-writes"]) {
        const expected = fixture.scenarios?.[scenario]?.expected
        const frozen = AUTHORITATIVE_DIGESTS[scenario]
        if (expected?.semanticChecksum !== frozen.semanticChecksum) {
            problems.push(`${scenario} semantic checksum is not frozen`)
        }
        if (expected?.oracleTraceSha256 !== frozen.oracleTraceSha256) {
            problems.push(`${scenario} oracle trace digest is not frozen`)
        }
    }
    return problems
}

export function validateFixture(fixture, source = "fixture") {
    if (!isRecord(fixture) || fixture.schemaVersion !== 1) {
        throw new Error(`${source}: expected fixture schemaVersion 1`)
    }
    requireNonEmptyString(fixture.id, `${source}.id`)
    requireUint32(fixture.checksumSeed, `${source}.checksumSeed`)

    const inputs = fixture.inputs
    if (!isRecord(inputs)) throw new Error(`${source}.inputs must be an object`)
    for (const key of [
        "items",
        "depth",
        "shared",
        "leaves",
        "subscribersPerItem",
        "steps",
        "window",
        "scroll",
        "metaWriteEvery",
    ]) {
        requirePositiveInteger(inputs[key], `${source}.inputs.${key}`)
    }
    if (inputs.window > inputs.items) {
        throw new Error(`${source}: window cannot exceed items`)
    }
    if (inputs.scroll > inputs.window) {
        throw new Error(`${source}: scroll cannot exceed window`)
    }
    if (inputs.leaves < inputs.subscribersPerItem) {
        throw new Error(`${source}: leaves must cover every subscriber view`)
    }

    const scenarios = fixture.scenarios
    if (!isRecord(scenarios)) {
        throw new Error(`${source}.scenarios must be an object`)
    }
    for (const name of ["writes", "no-writes"]) {
        const scenario = scenarios[name]
        if (
            !isRecord(scenario) ||
            typeof scenario.writesEnabled !== "boolean"
        ) {
            throw new Error(`${source}.scenarios.${name} is invalid`)
        }
        if (scenario.writesEnabled !== (name === "writes")) {
            throw new Error(
                `${source}.scenarios.${name}.writesEnabled is inconsistent`,
            )
        }
        const expected = scenario.expected
        if (!isRecord(expected)) {
            throw new Error(
                `${source}.scenarios.${name}.expected must be an object`,
            )
        }
        for (const key of [
            "renderReads",
            "notificationReads",
            "notifications",
            "subscriptions",
            "timedUnsubscriptions",
            "totalUnsubscriptions",
            "entityWrites",
            "metaWrites",
        ]) {
            requireNonNegativeInteger(
                expected[key],
                `${source}.scenarios.${name}.expected.${key}`,
            )
        }
        requireDigestOrPending(
            expected.semanticChecksum,
            `${source}.scenarios.${name}.expected.semanticChecksum`,
            8,
        )
        requireDigestOrPending(
            expected.oracleTraceSha256,
            `${source}.scenarios.${name}.expected.oracleTraceSha256`,
            64,
        )
    }

    if (
        scenarios.writes.expected.renderReads !==
        scenarios["no-writes"].expected.renderReads
    ) {
        throw new Error(
            `${source}: scrolling work must be identical in both scenarios`,
        )
    }

    const measurement = fixture.measurement
    if (!isRecord(measurement) || measurement.warmupProcesses !== 0) {
        throw new Error(
            `${source}: workload warmup must stay pinned to zero processes`,
        )
    }
    requirePositiveInteger(
        measurement.authoritativeSamples,
        `${source}.measurement.authoritativeSamples`,
    )
    if (
        !isRecord(measurement.percentiles) ||
        measurement.percentiles.p50 !== "median" ||
        measurement.percentiles.p95 !== "nearest-rank"
    ) {
        throw new Error(`${source}: percentile definitions have drifted`)
    }
    if (!isRecord(measurement.ceilingsMs)) {
        throw new Error(`${source}.measurement.ceilingsMs must be an object`)
    }
    requirePositiveFinite(
        measurement.ceilingsMs.p50,
        `${source}.measurement.ceilingsMs.p50`,
    )
    requirePositiveFinite(
        measurement.ceilingsMs.p95,
        `${source}.measurement.ceilingsMs.p95`,
    )

    const beta = fixture.currentBetaControl
    if (!isRecord(beta)) {
        throw new Error(`${source}.currentBetaControl must be an object`)
    }
    requireNonEmptyString(
        beta.packageVersion,
        `${source}.currentBetaControl.packageVersion`,
    )
    requireHexDigest(
        beta.tarballSha256,
        `${source}.currentBetaControl.tarballSha256`,
        64,
    )

    const runner = fixture.authoritativeRunner
    if (!isRecord(runner)) {
        throw new Error(`${source}.authoritativeRunner must be an object`)
    }
    for (const key of [
        "platform",
        "architecture",
        "hardwareModel",
        "cpuModel",
        "node",
        "macOS",
        "powerSource",
    ]) {
        requireNonEmptyString(
            runner[key],
            `${source}.authoritativeRunner.${key}`,
        )
    }
    requirePositiveInteger(
        runner.logicalCores,
        `${source}.authoritativeRunner.logicalCores`,
    )
    requirePositiveInteger(
        runner.memoryBytes,
        `${source}.authoritativeRunner.memoryBytes`,
    )

    for (const key of ["canonicalV1CounterKeys", "noWriteZeroCounterKeys"]) {
        const names = fixture[key]
        if (
            !Array.isArray(names) ||
            names.length === 0 ||
            names.some(
                name =>
                    typeof name !== "string" || !/^[a-z][A-Za-z]+$/.test(name),
            ) ||
            new Set(names).size !== names.length
        ) {
            throw new Error(
                `${source}.${key} must contain unique counter names`,
            )
        }
    }
    for (const key of fixture.noWriteZeroCounterKeys) {
        if (!fixture.canonicalV1CounterKeys.includes(key)) {
            throw new Error(`${source}: zero counter ${key} is not canonical`)
        }
    }
}

export function resolveAdapter(adapterName) {
    if (
        typeof adapterName !== "string" ||
        !/^[a-z][a-z0-9-]*$/.test(adapterName)
    ) {
        throw new Error(
            `adapter must be a checked-in adapter id, received ${String(adapterName)}`,
        )
    }
    const path = realpathSync(resolve(ADAPTERS_PATH, `${adapterName}.mjs`))
    if (!isWithin(path, ADAPTERS_PATH)) {
        throw new Error(
            `adapter ${adapterName} resolves outside the checked-in adapter directory`,
        )
    }
    if (/[/\\](?:v1-model|reference-model)(?:[/\\]|$)/i.test(path)) {
        throw new Error("the reference model is not a core benchmark target")
    }
    return path
}

export function isWithin(path, parent) {
    const normalizedPath = resolve(path)
    const normalizedParent = resolve(parent)
    return (
        normalizedPath === normalizedParent ||
        normalizedPath.startsWith(`${normalizedParent}${sep}`)
    )
}

export function publicWorkFrom(result) {
    return {
        renderReads: result.work.renderReads,
        notificationReads: result.work.notificationReads,
        notifications: result.work.notifications,
        subscriptions: result.work.subscriptions,
        timedUnsubscriptions: result.work.timedUnsubscriptions,
        totalUnsubscriptions: result.work.totalUnsubscriptions,
        entityWrites: result.work.entityWrites,
        metaWrites: result.work.metaWrites,
    }
}

export function assertExpectedResult(result, fixture, scenarioName, source) {
    if (!isRecord(result) || result.schemaVersion !== HARNESS_SCHEMA_VERSION) {
        throw new Error(`${source}: unsupported sample schema`)
    }
    if (result.fixtureId !== fixture.id || result.scenario !== scenarioName) {
        throw new Error(`${source}: sample fixture/scenario identity mismatch`)
    }
    const expected = fixture.scenarios[scenarioName].expected
    const actualWork = publicWorkFrom(result)
    for (const [key, expectedValue] of Object.entries(expected)) {
        if (key === "semanticChecksum" || key === "oracleTraceSha256") continue
        if (actualWork[key] !== expectedValue) {
            throw new Error(
                `${source}: ${key}=${String(actualWork[key])}, expected ${expectedValue}`,
            )
        }
    }
    if (expected.semanticChecksum === "PENDING") {
        throw new Error(`${source}: semantic checksum has not been frozen`)
    }
    if (result.semanticChecksum !== expected.semanticChecksum) {
        throw new Error(
            `${source}: semantic checksum ${result.semanticChecksum}, expected ${expected.semanticChecksum}`,
        )
    }
    if (result.postDrain.notificationsAdded !== 0) {
        throw new Error(
            `${source}: notifications continued after the synchronous workload`,
        )
    }
    if (result.mode === "oracle") {
        if (expected.oracleTraceSha256 === "PENDING") {
            throw new Error(
                `${source}: oracle trace digest has not been frozen`,
            )
        }
        if (result.oracleTraceSha256 !== expected.oracleTraceSha256) {
            throw new Error(
                `${source}: oracle trace ${result.oracleTraceSha256}, expected ${expected.oracleTraceSha256}`,
            )
        }
    }
}

export function assertCanonicalCounters(snapshot, fixture, source) {
    if (!isRecord(snapshot) || snapshot.kind !== "valdres-v1-core-counters") {
        throw new Error(`${source}: canonical v1 core counters are unavailable`)
    }
    if (!isRecord(snapshot.counters)) {
        throw new Error(
            `${source}: canonical counter payload must be an object`,
        )
    }
    for (const key of fixture.canonicalV1CounterKeys) {
        requireNonNegativeInteger(snapshot.counters[key], `${source}.${key}`)
    }
    return snapshot.counters
}

export function assertZeroCanonicalCounters(snapshot, fixture, source) {
    const counters = assertCanonicalCounters(snapshot, fixture, source)
    for (const key of fixture.canonicalV1CounterKeys) {
        if (counters[key] !== 0) {
            throw new Error(
                `${source}: ${key} must be zero immediately after reset, received ${counters[key]}`,
            )
        }
    }
    return counters
}

export function assertCounterDrainStable(
    beforeSnapshot,
    afterSnapshot,
    fixture,
    source,
) {
    const before = assertCanonicalCounters(
        beforeSnapshot,
        fixture,
        `${source} before`,
    )
    const after = assertCanonicalCounters(
        afterSnapshot,
        fixture,
        `${source} after`,
    )
    for (const key of fixture.canonicalV1CounterKeys) {
        if (after[key] !== before[key]) {
            throw new Error(
                `${source}: hidden graph work changed ${key} from ${before[key]} to ${after[key]}`,
            )
        }
    }
}

export function assertSynchronousCounterReset(result, source) {
    if (
        result !== null &&
        (typeof result === "object" || typeof result === "function")
    ) {
        let then
        try {
            then = result.then
        } catch (error) {
            throw new Error(`${source}: reset returned an invalid thenable`, {
                cause: error,
            })
        }
        if (typeof then === "function") {
            Promise.resolve(result).catch(() => {})
            throw new Error(`${source}: reset must be synchronous/non-thenable`)
        }
    }
}

export function candidateSourceIdentityProblems({
    declaredGitSha,
    packageGitHead,
    repository,
}) {
    const problems = []
    if (repository.dirty) {
        problems.push("candidate source identity requires a clean repository")
    }
    if (declaredGitSha !== repository.commit) {
        problems.push(
            "candidate build metadata gitSha does not match repository commit",
        )
    }
    if (packageGitHead !== null && packageGitHead !== declaredGitSha) {
        problems.push(
            "candidate build metadata gitSha does not match packed package gitHead",
        )
    }
    return problems
}

export function oracleEvidenceId({
    fixtureSha256,
    scenario,
    role,
    artifactSha256,
    adapterSha256,
    semanticChecksum,
    oracleTraceSha256,
}) {
    return `oracle-${sha256Bytes(
        JSON.stringify([
            fixtureSha256,
            scenario,
            role,
            artifactSha256,
            adapterSha256,
            semanticChecksum,
            oracleTraceSha256,
        ]),
    )}`
}

export function assertOraclePreflightCoverage(
    preflight,
    scenarios,
    targetRoles,
) {
    if (!isRecord(preflight) || preflight.status !== "passed") {
        throw new Error("authoritative oracle preflight did not pass")
    }
    if (preflight.completedBeforeTiming !== true) {
        throw new Error(
            "authoritative oracle preflight was not completed before timing",
        )
    }
    for (const scenario of scenarios) {
        for (const role of targetRoles) {
            const evidence = preflight.evidence?.[scenario]?.[role]
            if (
                !isRecord(evidence) ||
                typeof evidence.evidenceId !== "string" ||
                !/^oracle-[a-f0-9]{64}$/.test(evidence.evidenceId) ||
                typeof evidence.oracleTraceSha256 !== "string" ||
                !/^[a-f0-9]{64}$/.test(evidence.oracleTraceSha256)
            ) {
                throw new Error(
                    `authoritative oracle preflight is missing ${scenario}/${role}`,
                )
            }
        }
    }
}

export function assertTimingOracleLinks(
    results,
    preflight,
    scenarios,
    targetRoles,
) {
    for (const scenario of scenarios) {
        for (const role of targetRoles) {
            const expectedId =
                preflight.evidence?.[scenario]?.[role]?.evidenceId
            const result = results?.[scenario]?.[role]
            if (
                typeof expectedId !== "string" ||
                result?.oraclePreflightEvidenceId !== expectedId ||
                !Array.isArray(result.samples) ||
                result.samples.some(
                    sample => sample.oraclePreflightEvidenceId !== expectedId,
                )
            ) {
                throw new Error(
                    `timing results are not linked to oracle preflight ${scenario}/${role}`,
                )
            }
        }
    }
}

export function assertNoWriteCounterGate(counters, fixture, source) {
    for (const key of fixture.noWriteZeroCounterKeys) {
        if (counters[key] !== 0) {
            throw new Error(
                `${source}: ${key} must be zero, received ${counters[key]}`,
            )
        }
    }
}

function requireDigestOrPending(value, source, length) {
    if (value === "PENDING") return
    requireHexDigest(value, source, length)
}

function requireHexDigest(value, source, length) {
    if (
        typeof value !== "string" ||
        !new RegExp(`^[a-f0-9]{${length}}$`).test(value)
    ) {
        throw new Error(
            `${source} must be a ${length}-character lowercase hex digest`,
        )
    }
}

function requireNonEmptyString(value, source) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`${source} must be a non-empty string`)
    }
}

function requireUint32(value, source) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
        throw new Error(`${source} must be an unsigned 32-bit integer`)
    }
}

function requirePositiveInteger(value, source) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${source} must be a positive safe integer`)
    }
}

function requireNonNegativeInteger(value, source) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`${source} must be a non-negative safe integer`)
    }
}

function requirePositiveFinite(value, source) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${source} must be positive and finite`)
    }
}

function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}
