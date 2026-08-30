#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { readFileSync, realpathSync, writeFileSync } from "node:fs"
import os from "node:os"
import { basename, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { extractPackedArtifact, hashTree } from "./artifact.mjs"
import { runAuthoritativeOraclePreflight } from "./oracle-preflight.mjs"
import {
    DEFAULT_FIXTURE_PATH,
    HARNESS_SCHEMA_VERSION,
    assertCanonicalCounters,
    assertCounterDrainStable,
    assertExpectedResult,
    assertInitialViewCoreCounters,
    assertNoWriteCounterGate,
    assertOraclePreflightCoverage,
    assertTimingOracleLinks,
    assertZeroCanonicalCounters,
    authoritativeInitialViewCoreProblems,
    authoritativeFixtureProblems,
    candidateSourceIdentityProblems,
    median,
    nearestRank,
    publicWorkFrom,
    readFixture,
    resolveAdapter,
    sha256File,
} from "./lib.mjs"
import {
    INITIAL_VIEW_CORE,
    INITIAL_VIEW_CORE_SCENARIO,
} from "./initial-view-core.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const SAMPLE_RUNNER = resolve(HERE, "run-sample.mjs")

let artifacts = []
try {
    const options = parseArguments(process.argv.slice(2))
    const fixturePath = realpathSync(options.fixture)
    const fixture = readFixture(fixturePath)
    if (options.samples === null) {
        options.samples =
            options.mode === "timed"
                ? fixture.measurement.authoritativeSamples
                : 1
    }
    validateRunOptions(options, fixture)

    const runner = collectRunnerProvenance()
    const repository = collectRepositoryProvenance()
    const baselineArtifact = extractPackedArtifact(options.baselineTarball)
    artifacts.push(baselineArtifact)
    if (
        baselineArtifact.packageMetadata.version !==
            fixture.currentBetaControl.packageVersion ||
        baselineArtifact.tarballSha256 !==
            fixture.currentBetaControl.tarballSha256
    ) {
        throw new Error(
            "--baseline-tarball must be the fixture-pinned current beta control",
        )
    }
    const targets = [
        createTarget({
            role: "baseline",
            label: options.baselineLabel,
            adapter: options.baselineAdapter,
            artifact: baselineArtifact,
            buildMetadata: null,
        }),
    ]
    if (options.candidateTarball !== null) {
        const candidateArtifact = extractPackedArtifact(
            options.candidateTarball,
        )
        artifacts.push(candidateArtifact)
        targets.push(
            createTarget({
                role: "candidate",
                label: options.candidateLabel,
                adapter: options.candidateAdapter,
                artifact: candidateArtifact,
                buildMetadata: options.candidateBuildMetadata,
            }),
        )
    }

    const authoritativeChecks = validateAuthoritativeEligibility({
        options,
        fixturePath,
        fixture,
        runner,
        repository,
        targets,
    })
    if (options.authoritative && authoritativeChecks.length > 0) {
        throw new Error(
            `authoritative run is ineligible:\n- ${authoritativeChecks.join("\n- ")}`,
        )
    }

    const scenarios =
        options.scenario === "all"
            ? ["writes", "no-writes"]
            : [options.scenario]
    const oraclePreflight = options.authoritative
        ? runAuthoritativeOraclePreflight({
              fixturePath,
              scenarios,
              targets,
              runFreshProcess,
              validateSample(sample, target, scenario) {
                  assertExpectedResult(
                      sample,
                      fixture,
                      scenario,
                      `${target.label} ${scenario} authoritative oracle preflight`,
                  )
                  assertSampleProvenance(sample, target, fixturePath)
              },
          })
        : {
              status: "not-run",
              required: false,
              reason: "only authoritative timed runs require automatic oracle preflight",
          }
    if (options.authoritative) {
        assertOraclePreflightCoverage(
            oraclePreflight,
            scenarios,
            targets.map(target => target.role),
        )
    }
    const results = {}
    for (const scenario of scenarios) {
        results[scenario] = runScenario({
            options,
            fixture,
            fixturePath,
            scenario,
            targets,
            oraclePreflight,
        })
    }
    if (options.authoritative) {
        assertTimingOracleLinks(
            results,
            oraclePreflight,
            scenarios,
            targets.map(target => target.role),
        )
    }

    const comparison = buildComparison(results, targets, options.mode)
    const gate = buildGate({ options, fixture, results, targets })
    const output = {
        schemaVersion: HARNESS_SCHEMA_VERSION,
        kind: "valdres-core-load-suite",
        generatedAt: new Date().toISOString(),
        status:
            targets.length === 1
                ? "baseline-only-diagnostic"
                : options.authoritative
                  ? "authoritative-comparison"
                  : "diagnostic-comparison",
        fixture: {
            id: fixture.id,
            path: fixturePath,
            sha256: sha256File(fixturePath),
            checksumSeed: fixture.checksumSeed,
            inputs: fixture.inputs,
        },
        protocol: {
            mode: options.mode,
            scenarios,
            samplesPerTargetPerScenario:
                options.mode === "timed" ? options.samples : 1,
            freshProcessPerSample: true,
            timedWorkloadsPerProcess: options.mode === "timed" ? 1 : 0,
            warmupProcesses: fixture.measurement.warmupProcesses,
            timer:
                options.scenario === INITIAL_VIEW_CORE_SCENARIO
                    ? INITIAL_VIEW_CORE.timer
                    : "after import/construction; before initial render/subscription; after final 900-step loop; before final unmount",
            p50: fixture.measurement.percentiles.p50,
            p95: fixture.measurement.percentiles.p95,
            counterTimingSeparation: true,
        },
        invocation: {
            argv: process.argv,
            cwd: process.cwd(),
            nodeOptions: process.env.NODE_OPTIONS ?? "",
            nodeEnvInChildren: "production",
        },
        runner,
        repository,
        harness: {
            root: HERE,
            treeSha256: hashTree(HERE),
            sampleRunnerSha256: sha256File(SAMPLE_RUNNER),
        },
        targets: targets.map(target => target.provenance),
        oraclePreflight,
        results,
        comparison,
        authoritativeEligibility: {
            requested: options.authoritative,
            eligible: authoritativeChecks.length === 0,
            reasons: authoritativeChecks,
        },
        gate,
    }
    const serialized = `${JSON.stringify(output, null, 2)}\n`
    if (options.output !== null) writeFileSync(options.output, serialized)
    process.stdout.write(serialized)
    if (gate.status === "failed") process.exitCode = 2
} catch (error) {
    const message =
        error instanceof Error ? (error.stack ?? error.message) : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
} finally {
    for (const artifact of artifacts) artifact.cleanup()
}

function runScenario({
    options,
    fixture,
    fixturePath,
    scenario,
    targets,
    oraclePreflight,
}) {
    const sampleCount = options.mode === "timed" ? options.samples : 1
    const samplesByRole = Object.fromEntries(
        targets.map(target => [target.role, []]),
    )
    let processOrder = 0
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
        const orderedTargets =
            targets.length === 2 && sampleIndex % 2 === 1
                ? [targets[1], targets[0]]
                : targets
        for (const target of orderedTargets) {
            processOrder++
            const sample = runFreshProcess({
                mode: options.mode,
                fixture,
                fixturePath,
                scenario,
                target,
            })
            assertExpectedResult(
                sample,
                fixture,
                scenario,
                `${target.label} ${scenario} sample ${sampleIndex + 1}`,
            )
            assertSampleProvenance(sample, target, fixturePath)
            samplesByRole[target.role].push({
                sampleIndex: sampleIndex + 1,
                processOrder,
                processId: sample.process.pid,
                elapsedMs: sample.elapsedMs,
                semanticChecksum: sample.semanticChecksum,
                oracleTraceSha256: sample.oracleTraceSha256,
                selectedFinalValues: sample.selectedFinalValues,
                counterReset: sample.counterReset,
                publicWork: publicWorkFrom(sample),
                internalWork: sample.internalWork,
                postDrain: sample.postDrain,
                oraclePreflightEvidenceId:
                    oraclePreflight.evidence?.[scenario]?.[target.role]
                        ?.evidenceId ?? null,
            })
        }
    }

    return Object.fromEntries(
        targets.map(target => {
            const samples = samplesByRole[target.role]
            const common = {
                label: target.label,
                adapter: target.adapter,
                sampleCount: samples.length,
                semanticChecksum: samples[0].semanticChecksum,
                publicWork: samples[0].publicWork,
                oraclePreflightEvidenceId: samples[0].oraclePreflightEvidenceId,
                samples,
            }
            if (options.mode !== "timed") {
                if (
                    options.mode === "counters" &&
                    target.role === "candidate"
                ) {
                    const sample = samples[0]
                    if (
                        sample.counterReset?.synchronous !== true ||
                        sample.counterReset?.thenable !== false
                    ) {
                        throw new Error(
                            `candidate ${scenario}: counter reset was not proven synchronous`,
                        )
                    }
                    assertZeroCanonicalCounters(
                        sample.internalWork.initial,
                        fixture,
                        `candidate ${scenario} initial counters`,
                    )
                    for (const stage of [
                        "atTimerEnd",
                        "afterUnmount",
                        "afterDrain",
                        "afterDispose",
                        "afterDisposeDrain",
                    ]) {
                        assertCanonicalCounters(
                            sample.internalWork[stage],
                            fixture,
                            `candidate ${scenario} ${stage} counters`,
                        )
                    }
                    assertCounterDrainStable(
                        sample.internalWork.afterUnmount,
                        sample.internalWork.afterDrain,
                        fixture,
                        `candidate ${scenario} post-unmount drain`,
                    )
                    assertCounterDrainStable(
                        sample.internalWork.afterDispose,
                        sample.internalWork.afterDisposeDrain,
                        fixture,
                        `candidate ${scenario} post-dispose drain`,
                    )
                    const finalSnapshot = sample.internalWork.afterDisposeDrain
                    const counters = assertCanonicalCounters(
                        finalSnapshot,
                        fixture,
                        `candidate ${scenario} counters`,
                    )
                    if (scenario === "no-writes") {
                        assertNoWriteCounterGate(
                            counters,
                            fixture,
                            "candidate no-writes counter gate",
                        )
                    } else if (scenario === INITIAL_VIEW_CORE_SCENARIO) {
                        assertInitialViewCoreCounters(
                            counters,
                            fixture,
                            "candidate initial-view-core counter gate",
                        )
                    }
                }
                return [target.role, common]
            }
            const elapsed = samples.map(sample => sample.elapsedMs)
            return [
                target.role,
                {
                    ...common,
                    elapsedMs: elapsed,
                    p50Ms: median(elapsed),
                    p95Ms: nearestRank(elapsed, 0.95),
                },
            ]
        }),
    )
}

function runFreshProcess({ mode, fixturePath, scenario, target }) {
    const child = spawnSync(
        process.execPath,
        [
            SAMPLE_RUNNER,
            "--package-root",
            target.artifact.packageRoot,
            "--fixture",
            fixturePath,
            "--adapter",
            target.adapter,
            "--scenario",
            scenario,
            "--mode",
            mode,
            "--role",
            target.role,
            "--label",
            target.label,
        ],
        {
            encoding: "utf8",
            maxBuffer: 32 * 1024 * 1024,
            env: {
                ...process.env,
                NODE_ENV: "production",
                NODE_OPTIONS: "",
            },
        },
    )
    if (child.error) throw child.error
    if (child.status !== 0) {
        throw new Error(
            `${target.label} ${scenario} sample process failed (${child.status}):\n${child.stderr.trim()}`,
        )
    }
    const output = child.stdout.trim()
    if (output.length === 0 || output.includes("\n")) {
        throw new Error(
            `${target.label} ${scenario} sample must emit exactly one JSON line`,
        )
    }
    return JSON.parse(output)
}

function assertSampleProvenance(sample, target, fixturePath) {
    if (sample.fixtureSha256 !== sha256File(fixturePath)) {
        throw new Error(`${target.label}: sample fixture digest mismatch`)
    }
    if (
        sample.target.role !== target.role ||
        sample.target.label !== target.label ||
        sample.target.adapter !== target.adapter ||
        sample.target.adapterSha256 !== target.provenance.adapterSha256 ||
        sample.target.packageVersion !==
            target.artifact.packageMetadata.version ||
        sample.target.entrySha256 !== target.artifact.entrySha256 ||
        sample.target.distTreeSha256 !== target.artifact.distTreeSha256
    ) {
        throw new Error(`${target.label}: sample target provenance mismatch`)
    }
}

function createTarget({ role, label, adapter, artifact, buildMetadata }) {
    const adapterPath = resolveAdapter(adapter)
    return {
        role,
        label,
        adapter,
        adapterPath,
        artifact,
        provenance: {
            role,
            label,
            adapter,
            adapterPath,
            adapterSha256: sha256File(adapterPath),
            artifact: {
                tarball: artifact.tarball,
                tarballName: artifact.tarballName,
                tarballSha256: artifact.tarballSha256,
                package: artifact.packageMetadata,
                rootExport: artifact.exportPath,
                entrySha256: artifact.entrySha256,
                distTreeSha256: artifact.distTreeSha256,
                nodeResolutionConditions: [
                    "node",
                    "import",
                    "node-addons",
                    "default",
                ],
                environment: { NODE_ENV: "production", NODE_OPTIONS: "" },
            },
            buildMetadata:
                buildMetadata === null
                    ? {
                          status: "not-encoded-in-artifact",
                          buildCommand: null,
                          bundler: null,
                          minifier: null,
                          flags: null,
                      }
                    : {
                          status: "supplied",
                          sourcePath: buildMetadata.sourcePath,
                          sourceSha256: buildMetadata.sourceSha256,
                          declared: buildMetadata.declared,
                      },
        },
    }
}

function buildComparison(results, targets, mode) {
    if (targets.length !== 2) {
        return {
            status: "not-run",
            reason: "future v1 candidate tarball was not supplied",
        }
    }
    if (mode !== "timed") {
        return {
            status: "semantic-and-work-comparison-only",
            note: "counter/oracle processes never supply latency samples",
        }
    }
    return {
        status: "descriptive-only",
        note: "relative ratios do not replace the candidate absolute gate",
        scenarios: Object.fromEntries(
            Object.entries(results).map(([scenario, value]) => [
                scenario,
                {
                    candidateToBetaP50Ratio:
                        value.candidate.p50Ms / value.baseline.p50Ms,
                    candidateToBetaP95Ratio:
                        value.candidate.p95Ms / value.baseline.p95Ms,
                },
            ]),
        ),
    }
}

function buildGate({ options, fixture, results, targets }) {
    if (targets.length !== 2 || options.mode !== "timed") {
        return {
            status: "not-evaluated",
            reason:
                targets.length !== 2
                    ? "no future v1 candidate supplied"
                    : "latency gates use timed artifacts only",
        }
    }
    if (!options.authoritative) {
        return {
            status: "not-evaluated",
            reason: "diagnostic runs cannot pass or fail the release gate",
            ceilingsMs: fixture.measurement.ceilingsMs,
        }
    }
    const failures = []
    for (const [scenario, value] of Object.entries(results)) {
        if (value.candidate.p50Ms > fixture.measurement.ceilingsMs.p50) {
            failures.push(`${scenario} p50 ${value.candidate.p50Ms} ms`)
        }
        if (value.candidate.p95Ms > fixture.measurement.ceilingsMs.p95) {
            failures.push(`${scenario} p95 ${value.candidate.p95Ms} ms`)
        }
    }
    return {
        status: failures.length === 0 ? "passed" : "failed",
        ceilingsMs: fixture.measurement.ceilingsMs,
        failures,
    }
}

function validateRunOptions(options, fixture) {
    if (!new Set(["timed", "oracle", "counters"]).has(options.mode)) {
        throw new Error("--mode must be timed, oracle, or counters")
    }
    if (
        !new Set([
            "all",
            "writes",
            "no-writes",
            INITIAL_VIEW_CORE_SCENARIO,
        ]).has(options.scenario)
    ) {
        throw new Error(
            `--scenario must be all, writes, no-writes, or ${INITIAL_VIEW_CORE_SCENARIO}`,
        )
    }
    if (!Number.isSafeInteger(options.samples) || options.samples <= 0) {
        throw new Error("--samples must be a positive safe integer")
    }
    if (options.baselineAdapter !== "beta23") {
        throw new Error("the current-beta control must use the beta23 adapter")
    }
    if (options.mode !== "timed" && options.samples !== 1) {
        throw new Error(
            `${options.mode} mode runs exactly one fresh process per target/scenario`,
        )
    }
    if (
        options.candidateBuildMetadata !== null &&
        options.candidateTarball === null
    ) {
        throw new Error(
            "--candidate-build-metadata requires --candidate-tarball",
        )
    }
    if (options.authoritative) {
        if (options.mode !== "timed") {
            throw new Error("--authoritative is only valid for timed mode")
        }
        if (
            options.scenario !== "all" &&
            options.scenario !== INITIAL_VIEW_CORE_SCENARIO
        ) {
            throw new Error(
                "--authoritative requires both historical fixture scenarios or initial-view-core",
            )
        }
        if (options.samples < fixture.measurement.authoritativeSamples) {
            throw new Error(
                `--authoritative requires at least ${fixture.measurement.authoritativeSamples} samples`,
            )
        }
        if (options.candidateTarball === null) {
            throw new Error(
                "--authoritative requires a future v1 candidate tarball",
            )
        }
    }
}

function validateAuthoritativeEligibility({
    options,
    fixturePath,
    fixture,
    runner,
    repository,
    targets,
}) {
    const reasons = authoritativeFixtureProblems(fixturePath, fixture)
    if (options.scenario === INITIAL_VIEW_CORE_SCENARIO) {
        reasons.push(...authoritativeInitialViewCoreProblems())
    }
    const baseline = targets.find(target => target.role === "baseline")
    const candidate = targets.find(target => target.role === "candidate")
    if (options.mode !== "timed") reasons.push("mode is not timed")
    if (
        options.scenario !== "all" &&
        options.scenario !== INITIAL_VIEW_CORE_SCENARIO
    ) {
        reasons.push(
            "neither both historical scenarios nor initial-view-core was selected",
        )
    }
    if (options.samples < fixture.measurement.authoritativeSamples) {
        reasons.push(
            `sample count is below ${fixture.measurement.authoritativeSamples}`,
        )
    }
    if (candidate === undefined) reasons.push("future v1 candidate is absent")
    if (
        baseline.artifact.packageMetadata.version !==
            fixture.currentBetaControl.packageVersion ||
        baseline.artifact.tarballSha256 !==
            fixture.currentBetaControl.tarballSha256 ||
        baseline.adapter !== "beta23"
    ) {
        reasons.push("baseline is not the pinned current beta control")
    }
    if (candidate !== undefined && candidate.adapter !== "v1") {
        reasons.push("candidate does not use the checked-in v1 adapter")
    }
    if (candidate?.artifact.tarballSha256 === baseline.artifact.tarballSha256) {
        reasons.push("candidate and baseline artifacts are identical")
    }
    if (candidate !== undefined) {
        const metadataError = validateBuildMetadata(
            candidate.provenance.buildMetadata,
        )
        if (metadataError !== null) reasons.push(metadataError)
        const declaredGitSha =
            candidate.provenance.buildMetadata.status === "supplied"
                ? candidate.provenance.buildMetadata.declared.gitSha
                : null
        if (declaredGitSha !== null) {
            reasons.push(
                ...candidateSourceIdentityProblems({
                    declaredGitSha,
                    packageGitHead: candidate.artifact.packageMetadata.gitHead,
                    repository,
                }),
            )
        }
    }
    if (
        repository.dirty &&
        !reasons.includes(
            "candidate source identity requires a clean repository",
        )
    ) {
        reasons.push("repository worktree is dirty")
    }
    if ((process.env.NODE_OPTIONS ?? "") !== "") {
        reasons.push("NODE_OPTIONS is non-empty in the suite process")
    }
    for (const [key, expected] of Object.entries(fixture.authoritativeRunner)) {
        if (runner.identity[key] !== expected) {
            reasons.push(
                `runner ${key}=${String(runner.identity[key])}, expected ${String(expected)}`,
            )
        }
    }
    if (!runner.power.rawBattery.includes("Now drawing from 'AC Power'")) {
        reasons.push("runner is not drawing from AC power")
    }
    if (!runner.power.rawThermal.includes("No thermal warning")) {
        reasons.push("runner thermal state is not confirmed clean")
    }
    return reasons
}

function validateBuildMetadata(value) {
    if (value?.status !== "supplied") {
        return "candidate build provenance metadata is missing"
    }
    const declared = value.declared
    if (declared === null || typeof declared !== "object") {
        return "candidate build provenance metadata is invalid"
    }
    for (const key of ["gitSha", "buildCommand", "bundler", "minifier"]) {
        if (
            typeof declared[key] !== "string" ||
            declared[key].trim().length === 0
        ) {
            return `candidate build provenance is missing ${key}`
        }
    }
    if (!/^[a-f0-9]{40}$/.test(declared.gitSha)) {
        return "candidate build provenance gitSha must be a lowercase 40-character commit"
    }
    if (
        !Array.isArray(declared.flags) ||
        declared.flags.some(flag => typeof flag !== "string")
    ) {
        return "candidate build provenance flags must be a string array"
    }
    return null
}

function collectRunnerProvenance() {
    const cpus = os.cpus()
    const macOS = commandOutput("sw_vers", ["-productVersion"])
    const hardwareModel = commandOutput("sysctl", ["-n", "hw.model"])
    const cpuModel = commandOutput("sysctl", ["-n", "machdep.cpu.brand_string"])
    const rawBattery = commandOutput("pmset", ["-g", "batt"], true)
    const rawThermal = commandOutput("pmset", ["-g", "therm"], true)
    const powerSource =
        rawBattery.match(/Now drawing from '([^']+)'/)?.[1] ?? null
    return {
        identity: {
            platform: process.platform,
            architecture: process.arch,
            hardwareModel,
            cpuModel: cpuModel || cpus[0]?.model || null,
            logicalCores: cpus.length,
            memoryBytes: os.totalmem(),
            node: process.version,
            macOS,
            powerSource,
        },
        runtime: {
            node: process.version,
            v8: process.versions.v8,
            uv: process.versions.uv,
        },
        os: {
            platform: os.platform(),
            release: os.release(),
            architecture: os.arch(),
            hostname: os.hostname(),
        },
        power: { rawBattery, rawThermal },
    }
}

function collectRepositoryProvenance() {
    const root = commandOutput("git", ["rev-parse", "--show-toplevel"])
    const commit = commandOutput("git", ["rev-parse", "HEAD"])
    const status = commandOutput(
        "git",
        ["status", "--porcelain=v1", "--untracked-files=all"],
        true,
    )
    return {
        root,
        commit,
        dirty: status.length > 0,
        status: status.length === 0 ? [] : status.split("\n"),
    }
}

function commandOutput(command, args, allowFailure = false) {
    const result = spawnSync(command, args, {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
    })
    if (result.error) {
        if (allowFailure) return `unavailable: ${result.error.message}`
        throw result.error
    }
    if (result.status !== 0) {
        if (allowFailure) return `unavailable: ${result.stderr.trim()}`
        throw new Error(
            `${command} ${args.join(" ")} failed: ${result.stderr.trim()}`,
        )
    }
    return result.stdout.trim()
}

function parseArguments(args) {
    const values = new Map()
    let authoritative = false
    for (let index = 0; index < args.length; index++) {
        const flag = args[index]
        if (flag === "--authoritative") {
            if (authoritative)
                throw new Error("duplicate argument --authoritative")
            authoritative = true
            continue
        }
        if (!flag.startsWith("--"))
            throw new Error(`unexpected argument ${flag}`)
        const value = args[++index]
        if (value === undefined || value.startsWith("--")) {
            throw new Error(`missing value for ${flag}`)
        }
        if (values.has(flag)) throw new Error(`duplicate argument ${flag}`)
        values.set(flag, value)
    }
    const allowed = new Set([
        "--fixture",
        "--baseline-tarball",
        "--baseline-adapter",
        "--baseline-label",
        "--candidate-tarball",
        "--candidate-adapter",
        "--candidate-label",
        "--candidate-build-metadata",
        "--scenario",
        "--mode",
        "--samples",
        "--output",
    ])
    for (const flag of values.keys()) {
        if (!allowed.has(flag)) throw new Error(`unknown argument ${flag}`)
    }
    const baselineTarball = values.get("--baseline-tarball")
    if (baselineTarball === undefined) {
        throw new Error("--baseline-tarball is required")
    }
    const candidateBuildMetadataPath = values.get("--candidate-build-metadata")
    const candidateBuildMetadataSource =
        candidateBuildMetadataPath === undefined
            ? null
            : realpathSync(candidateBuildMetadataPath)
    return {
        fixture: values.get("--fixture") ?? DEFAULT_FIXTURE_PATH,
        baselineTarball,
        baselineAdapter: values.get("--baseline-adapter") ?? "beta23",
        baselineLabel: values.get("--baseline-label") ?? "current-beta.23",
        candidateTarball: values.get("--candidate-tarball") ?? null,
        candidateAdapter: values.get("--candidate-adapter") ?? "v1",
        candidateLabel: values.get("--candidate-label") ?? "future-v1",
        candidateBuildMetadata:
            candidateBuildMetadataSource === null
                ? null
                : {
                      sourcePath: candidateBuildMetadataSource,
                      sourceSha256: sha256File(candidateBuildMetadataSource),
                      declared: JSON.parse(
                          readFileSync(candidateBuildMetadataSource, "utf8"),
                      ),
                  },
        scenario: values.get("--scenario") ?? "all",
        mode: values.get("--mode") ?? "timed",
        samples: values.has("--samples")
            ? Number(values.get("--samples"))
            : null,
        output: values.get("--output") ?? null,
        authoritative,
    }
}
