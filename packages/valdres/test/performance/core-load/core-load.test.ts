import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
    AUTHORITATIVE_DIGESTS,
    DEFAULT_FIXTURE_PATH,
    assertCanonicalCounters,
    assertCounterDrainStable,
    assertNoWriteCounterGate,
    assertOraclePreflightCoverage,
    assertTimingOracleLinks,
    assertZeroCanonicalCounters,
    authoritativeFixtureProblems,
    candidateSourceIdentityProblems,
    median,
    nearestRank,
    oracleEvidenceId,
    readFixture,
    resolveAdapter,
    validateFixture,
} from "./lib.mjs"
import { createBenchmarkAdapter as createV1Adapter } from "./adapters/v1.mjs"
import { runAuthoritativeOraclePreflight } from "./oracle-preflight.mjs"
import { runCoreLoadWorkload } from "./workload.mjs"

describe("core-load benchmark protocol", () => {
    test("computes an ordinary median and nearest-rank p95", () => {
        expect(median([7, 1, 3, 5])).toBe(4)
        expect(median([7, 1, 3])).toBe(3)
        expect(nearestRank([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBe(10)
    })

    test("pins zero workload warmup and the strengthened fixture", () => {
        const fixture = readFixture()
        expect(fixture.measurement.warmupProcesses).toBe(0)
        expect(fixture.measurement.authoritativeSamples).toBe(50)
        expect(fixture.inputs).toEqual({
            items: 181,
            depth: 40,
            shared: 8,
            leaves: 8,
            subscribersPerItem: 6,
            steps: 900,
            window: 25,
            scroll: 8,
            metaWriteEvery: 25,
        })
    })

    test("no-writes keeps all scrolling subscription churn", () => {
        const fixture = readFixture()
        const expected = fixture.scenarios["no-writes"].expected
        const initialSubscriptions =
            fixture.inputs.window * fixture.inputs.subscribersPerItem
        const scrollingSubscriptions =
            fixture.inputs.steps *
            fixture.inputs.scroll *
            fixture.inputs.subscribersPerItem

        expect(expected.subscriptions).toBe(
            initialSubscriptions + scrollingSubscriptions,
        )
        expect(expected.subscriptions).toBe(43_350)
        expect(expected.timedUnsubscriptions).toBe(scrollingSubscriptions)
        expect(expected.timedUnsubscriptions).toBe(43_200)
        expect(expected.entityWrites).toBe(0)
        expect(expected.metaWrites).toBe(0)
        expect(expected.notifications).toBe(0)
    })

    test("rejects a fixture that introduces workload warmup", () => {
        const fixture = structuredClone(readFixture())
        fixture.measurement.warmupProcesses = 1
        expect(() => validateFixture(fixture, "mutated fixture")).toThrow(
            "workload warmup must stay pinned to zero processes",
        )
    })

    test("authoritative runs require the exact checked-in frozen fixture", () => {
        const fixture = readFixture()
        expect(
            authoritativeFixtureProblems(DEFAULT_FIXTURE_PATH, fixture),
        ).toEqual([])

        const mutated = structuredClone(fixture)
        mutated.scenarios.writes.expected.semanticChecksum = "00000000"
        mutated.scenarios["no-writes"].expected.oracleTraceSha256 = "0".repeat(
            64,
        )
        expect(
            authoritativeFixtureProblems(DEFAULT_FIXTURE_PATH, mutated),
        ).toContain("writes semantic checksum is not frozen")
        expect(
            authoritativeFixtureProblems(DEFAULT_FIXTURE_PATH, mutated),
        ).toContain("no-writes oracle trace digest is not frozen")

        const temporaryRoot = mkdtempSync(join(tmpdir(), "core-load-fixture-"))
        try {
            const copiedFixture = join(temporaryRoot, "fixture.v1.json")
            writeFileSync(copiedFixture, readFileSync(DEFAULT_FIXTURE_PATH))
            expect(
                authoritativeFixtureProblems(copiedFixture, fixture),
            ).toContain("fixture path is not the checked-in default fixture")
        } finally {
            rmSync(temporaryRoot, { recursive: true, force: true })
        }
    })

    test("only resolves checked-in adapter ids", () => {
        expect(resolveAdapter("beta23")).toEndWith("adapters/beta23.mjs")
        expect(() => resolveAdapter("../v1-model")).toThrow(
            "adapter must be a checked-in adapter id",
        )
    })

    test("requires every canonical counter and enforces the no-write zeros", () => {
        const fixture = readFixture()
        const counters = Object.fromEntries(
            fixture.canonicalV1CounterKeys.map(key => [key, 0]),
        )
        counters.firstMaterializations = 1_086
        const parsed = assertCanonicalCounters(
            { kind: "valdres-v1-core-counters", counters },
            fixture,
            "test counters",
        )
        expect(() =>
            assertNoWriteCounterGate(parsed, fixture, "test gate"),
        ).not.toThrow()
        parsed.validationWalks = 1
        expect(() =>
            assertNoWriteCounterGate(parsed, fixture, "test gate"),
        ).toThrow("validationWalks must be zero")
    })

    test("requires zero initial counters and rejects hidden drain work", () => {
        const fixture = readFixture()
        const zero = canonicalCounterSnapshot(fixture)
        expect(() =>
            assertZeroCanonicalCounters(zero, fixture, "initial"),
        ).not.toThrow()

        const nonzero = structuredClone(zero)
        nonzero.counters.firstMaterializations = 1
        expect(() =>
            assertZeroCanonicalCounters(nonzero, fixture, "initial"),
        ).toThrow("firstMaterializations must be zero immediately after reset")

        const afterDrain = structuredClone(zero)
        afterDrain.counters.orphanWalks = 1
        expect(() =>
            assertCounterDrainStable(
                zero,
                afterDrain,
                fixture,
                "post-unmount drain",
            ),
        ).toThrow("hidden graph work changed orphanWalks from 0 to 1")
    })

    test("rejects an asynchronous counter reset before the workload", async () => {
        const adapter = createNoWriteTestAdapter()
        adapter.resetWorkCounters = async () => {}
        await expect(
            runCoreLoadWorkload({
                adapter,
                fixture: smallFixture(),
                scenarioName: "no-writes",
                mode: "counters",
            }),
        ).rejects.toThrow("reset must be synchronous/non-thenable")
    })

    test("v1 adapter does not hide an instrumented reset thenable", async () => {
        const temporaryRoot = mkdtempSync(join(tmpdir(), "core-load-adapter-"))
        const countersSymbol = Symbol.for("valdres.test.coreCounters.v1")
        try {
            const runtimePath = join(temporaryRoot, "runtime.mjs")
            writeFileSync(
                runtimePath,
                "export function atom() {}\nexport function selector() {}\nexport function store() {}\n",
            )
            globalThis[countersSymbol] = {
                async reset() {},
                snapshot() {
                    return {}
                },
            }
            const adapter = await createV1Adapter({ entryPath: runtimePath })
            expect(adapter.resetWorkCounters()).toBeInstanceOf(Promise)
        } finally {
            delete globalThis[countersSymbol]
            rmSync(temporaryRoot, { recursive: true, force: true })
        }
    })

    test("candidate source identity matches clean HEAD and package gitHead", () => {
        const commit = "a".repeat(40)
        expect(
            candidateSourceIdentityProblems({
                declaredGitSha: commit,
                packageGitHead: commit,
                repository: { commit, dirty: false },
            }),
        ).toEqual([])
        expect(
            candidateSourceIdentityProblems({
                declaredGitSha: "b".repeat(40),
                packageGitHead: commit,
                repository: { commit, dirty: false },
            }),
        ).toEqual([
            "candidate build metadata gitSha does not match repository commit",
            "candidate build metadata gitSha does not match packed package gitHead",
        ])
        expect(
            candidateSourceIdentityProblems({
                declaredGitSha: commit,
                packageGitHead: commit,
                repository: { commit, dirty: true },
            }),
        ).toContain("candidate source identity requires a clean repository")
    })

    test("runs and links complete oracle preflight evidence", () => {
        const fixture = readFixture()
        const targets = ["baseline", "candidate"].map((role, index) => ({
            role,
            label: role,
            adapter: role === "baseline" ? "beta23" : "v1",
            artifact: { tarballSha256: String(index + 1).repeat(64) },
            provenance: { adapterSha256: String(index + 3).repeat(64) },
        }))
        const calls = []
        const preflight = runAuthoritativeOraclePreflight({
            fixturePath: DEFAULT_FIXTURE_PATH,
            scenarios: ["writes", "no-writes"],
            targets,
            runFreshProcess(input) {
                calls.push(
                    `${input.mode}:${input.scenario}:${input.target.role}`,
                )
                const expected = fixture.scenarios[input.scenario].expected
                return oracleSample(input.scenario, expected)
            },
            validateSample() {},
        })

        expect(calls).toEqual([
            "oracle:writes:baseline",
            "oracle:writes:candidate",
            "oracle:no-writes:baseline",
            "oracle:no-writes:candidate",
        ])
        expect(() =>
            assertOraclePreflightCoverage(
                preflight,
                ["writes", "no-writes"],
                ["baseline", "candidate"],
            ),
        ).not.toThrow()
        expect(preflight.evidence.writes.candidate.evidenceId).toBe(
            oracleEvidenceId({
                fixtureSha256:
                    "bc0e260b35d3deef4dbda8324d35e8eb409b7dd8625f2520ccda2c81aafb7c7a",
                scenario: "writes",
                role: "candidate",
                artifactSha256: "2".repeat(64),
                adapterSha256: "4".repeat(64),
                semanticChecksum: AUTHORITATIVE_DIGESTS.writes.semanticChecksum,
                oracleTraceSha256:
                    AUTHORITATIVE_DIGESTS.writes.oracleTraceSha256,
            }),
        )
        const linkedResults = Object.fromEntries(
            ["writes", "no-writes"].map(scenario => [
                scenario,
                Object.fromEntries(
                    ["baseline", "candidate"].map(role => {
                        const evidenceId =
                            preflight.evidence[scenario][role].evidenceId
                        return [
                            role,
                            {
                                oraclePreflightEvidenceId: evidenceId,
                                samples: [
                                    { oraclePreflightEvidenceId: evidenceId },
                                ],
                            },
                        ]
                    }),
                ),
            ]),
        )
        expect(() =>
            assertTimingOracleLinks(
                linkedResults,
                preflight,
                ["writes", "no-writes"],
                ["baseline", "candidate"],
            ),
        ).not.toThrow()
        linkedResults.writes.candidate.samples[0].oraclePreflightEvidenceId =
            "wrong"
        expect(() =>
            assertTimingOracleLinks(
                linkedResults,
                preflight,
                ["writes", "no-writes"],
                ["baseline", "candidate"],
            ),
        ).toThrow(
            "timing results are not linked to oracle preflight writes/candidate",
        )
        delete preflight.evidence["no-writes"].candidate
        expect(() =>
            assertOraclePreflightCoverage(
                preflight,
                ["writes", "no-writes"],
                ["baseline", "candidate"],
            ),
        ).toThrow(
            "authoritative oracle preflight is missing no-writes/candidate",
        )
    })

    test("executes no-write churn without relying on writes=0", async () => {
        const fixture = smallFixture()
        const result = await runCoreLoadWorkload({
            adapter: createNoWriteTestAdapter(),
            fixture,
            scenarioName: "no-writes",
            mode: "oracle",
        })

        expect(result.work).toEqual({
            renderReads: 28,
            notificationReads: 0,
            notifications: 0,
            subscriptions: 28,
            timedUnsubscriptions: 20,
            totalUnsubscriptions: 28,
            entityWrites: 0,
            metaWrites: 0,
        })
        expect(result.semanticChecksum).toMatch(/^[a-f0-9]{8}$/)
        expect(result.oracleTraceSha256).toMatch(/^[a-f0-9]{64}$/)
        expect(result.postDrain.notificationsAdded).toBe(0)
    })
})

function smallFixture() {
    const fixture = structuredClone(readFixture())
    fixture.id = "core-load-self-test"
    fixture.inputs = {
        items: 12,
        depth: 3,
        shared: 2,
        leaves: 3,
        subscribersPerItem: 2,
        steps: 5,
        window: 4,
        scroll: 2,
        metaWriteEvery: 2,
    }
    return fixture
}

function createNoWriteTestAdapter() {
    const values = new Map()
    const subscriptions = new Map()
    const get = state => {
        if (state.kind === "atom") {
            return values.has(state) ? values.get(state) : state.initialValue
        }
        return state.read(get)
    }
    return {
        id: "self-test",
        implementationKind: "test-only",
        instrumented: false,
        createAtom(initialValue, name) {
            return { kind: "atom", initialValue, name }
        },
        createSelector(read, name) {
            return { kind: "selector", read, name }
        },
        createStore() {
            return {}
        },
        createScope(root) {
            return root
        },
        get(_store, state) {
            return get(state)
        },
        update(_store, state, updater) {
            values.set(state, updater(get(state)))
        },
        set(_store, state, value) {
            values.set(state, value)
        },
        subscribe(_store, state, callback) {
            let callbacks = subscriptions.get(state)
            if (callbacks === undefined) {
                callbacks = new Set()
                subscriptions.set(state, callbacks)
            }
            callbacks.add(callback)
            return () => callbacks.delete(callback)
        },
        dispose() {},
        resetWorkCounters() {},
        snapshotWorkCounters() {
            return { kind: "unavailable", reason: "self-test" }
        },
    }
}

function canonicalCounterSnapshot(fixture) {
    return {
        kind: "valdres-v1-core-counters",
        counters: Object.fromEntries(
            fixture.canonicalV1CounterKeys.map(key => [key, 0]),
        ),
    }
}

function oracleSample(scenario, expected) {
    return {
        mode: "oracle",
        scenario,
        elapsedMs: null,
        semanticChecksum: expected.semanticChecksum,
        oracleTraceSha256: expected.oracleTraceSha256,
        selectedFinalValues: {},
        counterReset: { synchronous: true, thenable: false },
        process: { pid: 1 },
        work: {
            renderReads: expected.renderReads,
            notificationReads: expected.notificationReads,
            notifications: expected.notifications,
            subscriptions: expected.subscriptions,
            timedUnsubscriptions: expected.timedUnsubscriptions,
            totalUnsubscriptions: expected.totalUnsubscriptions,
            entityWrites: expected.entityWrites,
            metaWrites: expected.metaWrites,
        },
        postDrain: { notificationsAdded: 0 },
    }
}
